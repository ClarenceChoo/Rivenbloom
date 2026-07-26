import type { DialoguePage } from '../../dialogue/DialogueController';

export type DialogueShellOptions = {
  readonly onAdvance: () => void;
  readonly onChoice: (choiceId: string) => void;
};

export type DialogueShell = {
  readonly element: HTMLElement;
  setPage(page: DialoguePage): void;
  dispose(): void;
};

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const createDialogueShell = (options: DialogueShellOptions): DialogueShell => {
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) throw new Error('The Rivenbloom application root is unavailable.');
  const shell = element('section', 'dialogue-surface');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', 'Conversation');
  const panel = element('div', 'dialogue-panel');
  const speaker = element('p', 'dialogue-speaker');
  const text = element('p', 'dialogue-text');
  const actions = element('div', 'dialogue-actions');
  panel.append(speaker, text, actions);
  shell.append(panel);
  app.append(shell);

  const keyListener = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (document.activeElement instanceof HTMLButtonElement) return;
    event.preventDefault();
    const first = actions.querySelector('button');
    first?.click();
  };
  window.addEventListener('keydown', keyListener);

  return {
    element: shell,
    setPage(page) {
      speaker.textContent = page.speakerName;
      text.textContent = page.text;
      actions.replaceChildren();
      if (page.choices.length === 0) {
        const label = page.isTerminal ? 'End conversation' : 'Continue';
        const control = element('button', 'dialogue-continue', label);
        control.type = 'button';
        control.addEventListener('click', options.onAdvance);
        actions.append(control);
        control.focus();
        return;
      }
      for (const [index, choice] of page.choices.entries()) {
        const control = element('button', 'dialogue-choice', choice.text);
        control.type = 'button';
        control.addEventListener('click', () => options.onChoice(choice.id));
        actions.append(control);
        if (index === 0) control.focus();
      }
    },
    dispose() {
      window.removeEventListener('keydown', keyListener);
      shell.remove();
    }
  };
};
