import { requireElement } from '../dom';
export class Notice {
  private element: HTMLElement;
  constructor(selector: string, host?: HTMLElement) {
    this.element = requireElement(selector, host);
  }
  show(message: string, seconds?: number) {
    this.element.textContent = message;
    this.element.hidden = false;
    if (seconds) {
      window.setTimeout(() => {
        this.element.hidden = true;
      }, seconds * 1000);
    }
  }
}
