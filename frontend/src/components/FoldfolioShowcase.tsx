import React, { useEffect, useRef } from 'react';
import './iphone-duo/styles.css';
import { requireElement } from './iphone-duo/dom';
import { createRail, type Rail } from './iphone-duo/ui/rail';
import { Loader, Notice, Uploader } from './iphone-duo/components';
import type { Highlight } from './iphone-duo/device/highlights';

export const FoldfolioShowcase: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const list = requireElement<HTMLUListElement>('#highlight-list', root);
    const sheet = requireElement<HTMLDivElement>('#highlight-sheet', root);
    list.replaceChildren();
    sheet.replaceChildren();

    const notice = new Notice('#notice', root);
    const loader = new Loader('#loader', root);
    const uploader = new Uploader('#upload', '#upload-file', '#reset-upload', root);

    let onSelect: (highlight: Highlight) => void = () => {};
    const rail: Rail = createRail(
      list,
      sheet,
      requireElement<HTMLButtonElement>('#previous-highlight', root),
      requireElement<HTMLButtonElement>('#next-highlight', root),
      (highlight) => onSelect(highlight),
    );

    let cleanupExperience: (() => void) | null = null;
    let cancelled = false;

    async function boot() {
      loader.setProgress(0.02, 'Loading 3D model');
      let experience: typeof import('./iphone-duo/experience');
      try {
        experience = await import('./iphone-duo/experience');
      } catch (error) {
        console.error(error);
        loader.fail('Could not load the viewer.');
        notice.show('The 3D viewer could not be loaded. Refresh the page to try again.');
        return;
      }

      if (cancelled) return;

      const instance = await experience.start({
        host: requireElement('#stage', root!),
        rack: requireElement('#highlights', root!),
        rail,
        notice,
        loader,
        uploader,
        bindSelect(handler) {
          onSelect = handler;
        },
      });

      if (cancelled) {
        instance.stop();
      } else {
        cleanupExperience = () => instance.stop();
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (cleanupExperience) {
        cleanupExperience();
      }
      list.replaceChildren();
      sheet.replaceChildren();
    };
  }, []);

  return (
    <section id="foldfolio-demo" ref={rootRef} aria-label="iPhone Duo Foldable Design Showcase">
      <div className="page">
        <div className="page-header">
          <h2 className="page-title">Take a closer look.</h2>
          <div className="upload-row">
            <button
              type="button"
              id="reset-upload"
              className="reset-button"
              aria-label="Reset to default image"
              title="Reset to default image"
              hidden
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
                <path d="M4.5 4.5v4h4" />
              </svg>
            </button>
            <button type="button" id="upload" className="upload-button" disabled>
              Upload custom image
            </button>
          </div>
        </div>

        <section className="viewer" aria-label="Foldable design">
          <div
            id="stage"
            className="stage"
            role="img"
            aria-label="3D model of the device. Drag to rotate and scroll to zoom."
          />

          <div
            id="loader"
            className="loader"
            role="progressbar"
            aria-label="Loading 3D model"
            aria-busy="true"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
          >
            <span className="loader-spinner" aria-hidden="true" />
            <span className="loader-label">Loading 3D model</span>
            <span className="loader-track" aria-hidden="true">
              <span className="loader-bar" />
            </span>
          </div>

          <div className="highlights" id="highlights">
            <div className="highlight-sheet is-collapsed" id="highlight-sheet" aria-live="polite" />
            <div className="highlight-steps">
              <button
                type="button"
                id="previous-highlight"
                className="step-button"
                aria-label="Previous highlight"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6.5 14.5 5.5-5.5 5.5 5.5" />
                </svg>
              </button>
              <button
                type="button"
                id="next-highlight"
                className="step-button"
                aria-label="Next highlight"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
                </svg>
              </button>
            </div>
            <ul className="highlight-list" id="highlight-list" />
          </div>
        </section>

        <input type="file" id="upload-file" accept="image/*" hidden />
      </div>
      <div id="notice" className="notice" role="status" aria-live="polite" hidden />
    </section>
  );
};
