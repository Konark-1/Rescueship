import { requireElement } from '../dom';
export class Uploader {
  private button: HTMLButtonElement;
  private field: HTMLInputElement;
  private reset: HTMLButtonElement;
  constructor(buttonSelector: string, fieldSelector: string, resetSelector: string, host?: HTMLElement) {
    this.button = requireElement(buttonSelector, host);
    this.field = requireElement(fieldSelector, host);
    this.reset = requireElement(resetSelector, host);
  }
  setDisabled(disabled: boolean) {
    this.button.disabled = disabled;
  }
  setCustom(custom: boolean) {
    this.reset.hidden = !custom;
  }
  onReset(callback: () => void) {
    this.reset.addEventListener('click', () => {
      this.setCustom(false);
      callback();
    });
  }
  onChange(callback: (file: File) => void) {
    this.button.addEventListener('click', () => this.field.click());
    this.field.addEventListener('change', () => {
      const file = this.field.files?.[0];
      this.field.value = '';
      if (file) callback(file);
    });
  }
}
