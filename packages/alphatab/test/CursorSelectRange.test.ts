import { describe, expect, it } from 'vitest';
import { AlphaTabApiBase, type PlaybackHighlightChangeEventArgs } from '@coderline/alphatab/AlphaTabApiBase';
import { EventEmitterOfT } from '@coderline/alphatab/EventEmitter';
import { Beat } from '@coderline/alphatab/model/Beat';

// Covers the playback range selection path: _cursorSelectRange resolves beat bounds via
// BoundsLookup.findBeat which may legitimately return null (e.g. partially updated bounds
// or beats outside the rendered area). Missing bounds must clear the highlight instead of
// crashing on the bounds dereference below.
describe('AlphaTabApiBase._cursorSelectRange', () => {
    it('clears the highlight instead of crashing when beat bounds cannot be found', () => {
        const startBeat = new Beat();
        const endBeat = new Beat();

        const events: PlaybackHighlightChangeEventArgs[] = [];
        const playbackRangeHighlightChanged = new EventEmitterOfT<PlaybackHighlightChangeEventArgs>();
        playbackRangeHighlightChanged.on(e => events.push(e));

        let cleared = 0;
        const fakeApi: any = {
            _renderer: {
                boundsLookup: {
                    findBeat: () => null
                }
            },
            _selectionWrapper: {
                clear: () => {
                    cleared++;
                },
                appendChild: () => {}
            },
            _tickCache: {
                getBeatStart: (b: Beat) => (b === startBeat ? 0 : 100)
            },
            uiFacade: {
                createSelectionElement: () => {
                    throw new Error('no selection elements may be created without bounds');
                }
            },
            playbackRangeHighlightChanged
        };

        const selectRange = (AlphaTabApiBase.prototype as any)._cursorSelectRange;

        expect(() => selectRange.call(fakeApi, { beat: startBeat }, { beat: endBeat })).not.toThrow();

        expect(cleared).toBe(1);
        expect(events).toEqual([{}]);
    });
});
