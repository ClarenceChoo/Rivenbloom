import AVFoundation
import Foundation

struct Note: Decodable {
    let beat: Double
    let duration: Double
    let pitch: UInt8
    let velocity: UInt8
}

struct Part: Decodable {
    let name: String
    let program: UInt8
    let percussion: Bool
    let gain: Float
    let pan: Float
    let reverb: Float
    let notes: [Note]
    let instrumentFiles: [String]?
    let sampleGainDb: Float?
    let expression: [Expression]?
}

struct Expression: Decodable {
    let beat: Double
    let value: UInt8
}

struct Score: Decodable {
    let id: String
    let bpm: Double
    let beats: Double
    let loop: Bool
    let tracks: [Part]
}

struct Event {
    let frame: Int64
    let part: Int
    let pitch: UInt8
    let velocity: UInt8
    let on: Bool
    let controller: UInt8?
}

enum RenderError: Error {
    case usage, invalidScore, allocation, stalled, engineError
}

// A warm-up cycle allows instrument releases and reverb to cross the loop seam.
func render(score: Score, destination: URL, solo: String?) throws {
    guard score.bpm > 0, score.beats > 0 else { throw RenderError.invalidScore }
    let rate = 48_000.0
    let framesPerBeat = rate * 60 / score.bpm
    let cycle = Int64((score.beats * framesPerBeat).rounded())
    let startFrame: Int64 = score.loop ? cycle : 0
    let endFrame = score.loop ? cycle * 2 : cycle + Int64(rate * 5)
    guard let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)
    else { throw RenderError.allocation }
    let engine = AVAudioEngine()
    let bank = URL(fileURLWithPath:
        "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
    var samplers: [AVAudioUnitSampler] = []
    for track in score.tracks {
        let sampler = AVAudioUnitSampler()
        let room = AVAudioUnitReverb()
        let position = AVAudioMixerNode()
        engine.attach(sampler)
        engine.attach(room)
        engine.attach(position)
        engine.connect(sampler, to: room, format: format)
        engine.connect(room, to: position, format: format)
        engine.connect(position, to: engine.mainMixerNode, format: format)
        room.loadFactoryPreset(track.instrumentFiles == nil ? .largeHall2 : .mediumHall)
        room.wetDryMix = track.reverb
        position.pan = track.pan
        position.outputVolume = (solo == nil || solo == track.name) ? track.gain : 0
        if let instrumentFiles = track.instrumentFiles {
            guard !instrumentFiles.isEmpty else { throw RenderError.invalidScore }
            let sampleGainDb = track.sampleGainDb ?? 0
            guard (-90...12).contains(sampleGainDb) else { throw RenderError.invalidScore }
            let instruments = instrumentFiles.map { URL(fileURLWithPath: $0) }
            if instruments.count == 1 && instruments[0].pathExtension == "exs" {
                try sampler.loadInstrument(at: instruments[0])
            } else {
                try sampler.loadAudioFiles(at: instruments)
            }
            sampler.overallGain = sampleGainDb
        } else {
            try sampler.loadSoundBankInstrument(at: bank, program: track.program,
                bankMSB: track.percussion ? 120 : 121, bankLSB: 0)
        }
        sampler.sendController(7, withValue: 100, onChannel: 0)
        sampler.sendController(91, withValue: 0, onChannel: 0)
        samplers.append(sampler)
    }
    engine.mainMixerNode.outputVolume = 0.65
    var events: [Event] = []
    for repeatIndex in 0..<(score.loop ? 2 : 1) {
        let offset = Int64(repeatIndex) * cycle
        for (part, track) in score.tracks.enumerated() {
            for note in track.notes {
                guard note.beat >= 0, note.duration > 0,
                      note.beat + note.duration <= score.beats + 0.0001,
                      note.pitch < 128, note.velocity > 0, note.velocity < 128
                else { throw RenderError.invalidScore }
                events.append(Event(frame: offset + Int64((note.beat * framesPerBeat).rounded()),
                    part: part, pitch: note.pitch, velocity: note.velocity, on: true, controller: nil))
                events.append(Event(frame: offset + Int64(((note.beat + note.duration) * framesPerBeat).rounded()),
                    part: part, pitch: note.pitch, velocity: 0, on: false, controller: nil))
            }
            for point in track.expression ?? [] {
                guard point.beat >= 0, point.beat < score.beats, point.value < 128
                else { throw RenderError.invalidScore }
                events.append(Event(frame: offset + Int64((point.beat * framesPerBeat).rounded()),
                    part: part, pitch: 0, velocity: point.value, on: false, controller: 11))
            }
        }
    }
    events.sort { a, b in
        if a.frame != b.frame { return a.frame < b.frame }
        return !a.on && b.on
    }
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 1024)
    try engine.start()
    defer { engine.stop() }
    // Close explicitly before the caller inspects the WAV header.
    var output: AVAudioFile? = try AVAudioFile(forWriting: destination, settings: [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: rate,
        AVNumberOfChannelsKey: 2,
        AVLinearPCMBitDepthKey: 32,
        AVLinearPCMIsFloatKey: true,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
    ])
    var eventIndex = 0
    var stalls = 0
    while engine.manualRenderingSampleTime < endFrame {
        let frame = engine.manualRenderingSampleTime
        while eventIndex < events.count && events[eventIndex].frame <= frame {
            let event = events[eventIndex]
            if let controller = event.controller {
                samplers[event.part].sendController(controller, withValue: event.velocity, onChannel: 0)
            } else if event.on {
                samplers[event.part].startNote(event.pitch, withVelocity: event.velocity, onChannel: 0)
            } else {
                samplers[event.part].stopNote(event.pitch, onChannel: 0)
            }
            eventIndex += 1
        }
        let nextEvent = eventIndex < events.count ? events[eventIndex].frame : endFrame
        let boundary = frame < startFrame ? startFrame : endFrame
        let count = AVAudioFrameCount(min(1024, nextEvent - frame, boundary - frame))
        guard count > 0 else { throw RenderError.stalled }
        switch try engine.renderOffline(count, to: buffer) {
        case .success:
            if frame >= startFrame { try output?.write(from: buffer) }
            stalls = 0
        case .cannotDoInCurrentContext, .insufficientDataFromInputNode:
            stalls += 1
            if stalls > 100 { throw RenderError.stalled }
        case .error: throw RenderError.engineError
        @unknown default: throw RenderError.engineError
        }
    }
    output = nil
}

func main() throws {
    let args = CommandLine.arguments
    guard args.count == 3 || args.count == 4 else { throw RenderError.usage }
    let score = try JSONDecoder().decode(Score.self,
        from: Data(contentsOf: URL(fileURLWithPath: args[1])))
    try render(score: score, destination: URL(fileURLWithPath: args[2]),
        solo: args.count == 4 ? args[3] : nil)
    print("Rendered \(score.id)")
}

do { try main() } catch {
    FileHandle.standardError.write(Data("Audio render failed: \(error)\n".utf8))
    exit(1)
}
