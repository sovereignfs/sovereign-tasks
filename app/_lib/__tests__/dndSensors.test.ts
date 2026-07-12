// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { shouldHandleDndEvent } from '../dndSensors';

describe('shouldHandleDndEvent', () => {
  it('allows a drag to start from a plain element', () => {
    const el = document.createElement('span');
    expect(shouldHandleDndEvent(el)).toBe(true);
  });

  it('allows a drag to start from an element marked data-no-dnd=false or unmarked ancestors', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('span');
    outer.appendChild(inner);
    expect(shouldHandleDndEvent(inner)).toBe(true);
  });

  it('refuses a drag from an element itself marked data-no-dnd', () => {
    const el = document.createElement('button');
    el.setAttribute('data-no-dnd', '');
    expect(shouldHandleDndEvent(el)).toBe(false);
  });

  it('refuses a drag from a descendant of a data-no-dnd ancestor', () => {
    const zone = document.createElement('div');
    zone.setAttribute('data-no-dnd', '');
    const icon = document.createElement('svg');
    zone.appendChild(icon);
    expect(shouldHandleDndEvent(icon)).toBe(false);
  });

  it('stops excluding once outside the data-no-dnd subtree', () => {
    const row = document.createElement('div');
    const excludedZone = document.createElement('div');
    excludedZone.setAttribute('data-no-dnd', '');
    const title = document.createElement('a');
    row.appendChild(excludedZone);
    row.appendChild(title);
    expect(shouldHandleDndEvent(title)).toBe(true);
  });

  it('allows a drag when the target is not an Element (e.g. null or a text node)', () => {
    expect(shouldHandleDndEvent(null)).toBe(true);
    const text = document.createTextNode('hello');
    expect(shouldHandleDndEvent(text as unknown as EventTarget)).toBe(true);
  });
});
