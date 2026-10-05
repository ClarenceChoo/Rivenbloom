/// <reference types="vite/client" />

interface Window {
  readonly __RIVENBLOOM_TEST__?: Readonly<{
    read(): Readonly<{
      activeScene: string;
      titleReady: boolean;
      slotStates: readonly ('loading' | 'empty' | 'ready' | 'corrupt' | 'error')[];
      transition: Readonly<{ mode: 'new' | 'load'; slotId: string }> | null;
      world: Readonly<{
        slotId: string;
        mode: 'new' | 'load';
        areaId: string;
        roomId: string;
        checkpointId: string;
        position: Readonly<{ x: number; y: number }>;
      }> | null;
      player: Readonly<{
        position: Readonly<{ x: number; y: number }>;
        velocity: Readonly<{ x: number; y: number }>;
        state: string;
        grounded: boolean;
        animationIntent: string;
      }> | null;
      camera: Readonly<{ scrollX: number; scrollY: number; zoom: number }> | null;
      combat: Readonly<{
        actionSequence: number;
        lastAcceptedAction: 'attack-light' | 'attack-heavy' | 'block' | 'dash' | 'cast' | null;
        activeAttackId: string | null;
        attackFrame: number | null;
        attackPhase: 'anticipation' | 'active' | 'recovery' | null;
        currentMana: number;
        selectedAbilityId: string;
        guarding: boolean;
        parryActive: boolean;
        invulnerable: boolean;
        projectiles: readonly Readonly<{
          instanceId: number;
          projectileId: string;
          position: Readonly<{ x: number; y: number }>;
        }>[];
        projectileCount: number;
        confirmedHitCount: number;
        hitStopRemainingMs: number;
      }> | null;
      encounter: Readonly<{
        disposed: boolean;
        stepIndex: number;
        simulationTimeMs: number;
        enemies: readonly Readonly<{
          combatantId: string;
          actorId: string;
          state: string;
          position: Readonly<{ x: number; y: number }>;
          facing: 'left' | 'right';
          health: number;
          maxHealth: number;
          poise: number;
          maxPoise: number;
          activeAttackId: string | null;
          attackPhase: 'telegraph' | 'active' | 'recovery' | null;
          hidden: boolean;
          targetable: boolean;
        }>[];
        directors: readonly Readonly<{
          encounterKey: string;
          pressure: number;
          leases: number;
        }>[];
        ordnance: readonly Readonly<{
          instanceId: number;
          attackId: string;
          ownerId: string;
          position: Readonly<{ x: number; y: number }>;
          bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
          armsAtMs: number;
          expiresAtMs: number;
          armed: boolean;
          contactedTargets: number;
        }>[];
        activeOrdnance: number;
        journalSequence: number;
        counters: Readonly<{
          contacts: number;
          playerContacts: number;
          enemyContacts: number;
          ordnanceContacts: number;
          resolutions: number;
          feedback: number;
          attackerCommands: number;
          stateChanges: number;
          drops: number;
          ordnancePlanted: number;
          defeats: number;
        }>;
        playerVitality: Readonly<{
          currentHealth: number;
          maxHealth: number;
          currentPoise: number;
          maxPoise: number;
          armour: number;
          resistances: Readonly<Record<string, number>>;
        }> | null;
        lastResolution: Readonly<{
          source: 'player' | 'enemy' | 'ordnance';
          targetId: string;
          kind: 'unresolved' | 'ignored' | 'parried' | 'absorbed' | 'resolved';
          guard: 'none' | 'block' | 'guard-break' | 'parry' | 'aegis' | null;
          healthDamage: number;
          defeated: boolean;
        }> | null;
      }> | null;
      worldUi: Readonly<{
        revision: number;
        area: Readonly<{ areaId: string; label: string }>;
        room: Readonly<{ roomId: string; label: string }>;
        prompt: string | null;
        player: Readonly<{
          currentHealth: number;
          maxHealth: number;
          currentMana: number;
          maxMana: number;
          experience: number;
          currency: number;
          weaponLevel: number;
        }>;
        checkpoint: Readonly<{ checkpointId: string; label: string }>;
        world: Readonly<{
          discoveredRoomIds: readonly string[];
          objects: Readonly<{
            roomId: string;
            puzzles: readonly Readonly<{
              puzzleId: string;
              state: 'advanced' | 'solved';
              activatedMechanismIds?: readonly string[];
            }>[];
            chests: readonly Readonly<{ chestId: string; state: 'closed' | 'opened' }>[];
            discoveries: readonly Readonly<{
              discoveryId: string;
              state: 'available' | 'claimed';
            }>[];
            shortcuts: readonly Readonly<{ shortcutId: string; state: 'closed' | 'opened' }>[];
            breakables: readonly Readonly<{
              breakableId: string;
              state: 'closed' | 'opened';
            }>[];
          }>;
        }>;
        quests: readonly Readonly<{
          questId: string;
          displayName: string;
          stageId: string;
          title: string;
          objective: string;
          status: 'active' | 'complete';
        }>[];
        inventory: readonly Readonly<{
          itemId: string;
          displayName: string;
          description: string;
          category: 'material' | 'quest' | 'charm' | 'recovery';
          quantity: number;
          equippedSlots: readonly string[];
        }>[];
        autosave: 'idle' | 'queued' | 'failed';
      }> | null;
      modal: Readonly<{
        sessionId: number;
        revision: number;
        mode: 'dialogue' | 'shop';
        actorId: string;
        speaker: string;
        copy: string;
        choices: readonly Readonly<{ choiceId: string; text: string }>[];
        offers: readonly Readonly<{
          offerId: string;
          displayName: string;
          description: string;
          price: number;
          available: boolean;
          reason: string | null;
        }>[];
        error: string | null;
      }> | null;
      lastDomainEvent:
        | Readonly<{
            sequence: number;
            kind: 'progression';
            event: Readonly<{ kind: string; id: string | null; amount: number | null }>;
          }>
        | Readonly<{
            sequence: number;
            kind: 'checkpoint-activated' | 'death-restored';
            checkpointId: string;
          }>
        | null;
      domainEvents: readonly Readonly<{
        sequence: number;
        kind: 'progression' | 'checkpoint-activated' | 'death-restored';
        checkpointId?: string;
        event?: Readonly<{ kind: string; id: string | null; amount: number | null }>;
      }>[];
      runtimeSaveRevision: number | null;
      deathReload: Readonly<{
        slotId: string;
        count: number;
        initial: Readonly<{
          position: Readonly<{ x: number; y: number }>;
          currentHealth: number;
          maxHealth: number;
          currentMana: number;
          maxMana: number;
          projectileCount: number;
          activeOrdnance: number;
          enemiesFresh: boolean;
        }> | null;
      }> | null;
    }>;
    act(
      action:
        | Readonly<{ kind: 'respawn' }>
        | Readonly<{ kind: 'defeat-enemies'; combatantIds: readonly string[] }>,
    ): void;
  }>;
}
