import { describe, expect, it } from 'vitest';
import { AlphaTabApiBase } from '@coderline/alphatab/AlphaTabApiBase';
import { EventEmitter } from '@coderline/alphatab/EventEmitter';
import { Beat } from '@coderline/alphatab/model/Beat';

// After a render, the playback range highlight is placed again against the new bounds. A beat press
// (mouse down, no move to another beat and no mouse up yet) only has a selection start, and a render
// can finish while the press is still open (e.g. a resize render triggered by the container).
describe('AlphaTabApiBase._onPostRenderFinished', () => {
    function createApi(selectionStart: unknown, selectionEnd: unknown) {
        const selectRangeCalls: unknown[][] = [];
        let postRenderFinishedCount = 0;

        const api: any = Object.create(AlphaTabApiBase.prototype);
        api._isDestroyed = false;
        api._renderer = { boundsLookup: null };
        api._beatVisibilityChecker = {};
        api._previousTick = 0;
        api._cursorUpdateTick = () => {};
        api._cursorSelectRange = (start: unknown, end: unknown) => {
            selectRangeCalls.push([start, end]);
        };
        api._selectionStart = selectionStart;
        api._selectionEnd = selectionEnd;
        api.postRenderFinished = new EventEmitter();
        api.postRenderFinished.on(() => {
            postRenderFinishedCount++;
        });
        api.uiFacade = { triggerEvent: () => {} };
        api.container = {};

        return {
            api,
            selectRangeCalls,
            get postRenderFinishedCount() {
                return postRenderFinishedCount;
            }
        };
    }

    it('keeps a pending beat press without a selection end', () => {
        const pressedBeat = new Beat();
        const test = createApi({ beat: pressedBeat }, undefined);

        expect(() => test.api._onPostRenderFinished()).not.toThrow();

        expect(test.postRenderFinishedCount).toBe(1);
        expect(test.api._selectionStart.beat).toBe(pressedBeat);
        expect(test.api._selectionEnd).toBeUndefined();
    });

    it('places the selected range again with bounds from the new render', () => {
        const startBeat = new Beat();
        const endBeat = new Beat();
        const staleBounds = {};
        const test = createApi({ beat: startBeat, bounds: staleBounds }, { beat: endBeat, bounds: staleBounds });

        test.api._onPostRenderFinished();

        expect(test.selectRangeCalls).toEqual([[{ beat: startBeat }, { beat: endBeat }]]);
        expect(test.postRenderFinishedCount).toBe(1);
    });
});
