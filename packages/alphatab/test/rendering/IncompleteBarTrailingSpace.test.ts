/**
 * Layout coverage for `display.incompleteBarTrailingSpace`. Reads private post-beat
 * glyph positions to verify barline alignment, so web-only.
 *
 * @target web
 */
import { AlphaTexImporter } from '@coderline/alphatab/importer/AlphaTexImporter';
import { ByteBuffer } from '@coderline/alphatab/io/ByteBuffer';
import type { BarRendererBase } from '@coderline/alphatab/rendering/BarRendererBase';
import { BarLineGlyph } from '@coderline/alphatab/rendering/glyphs/BarLineGlyph';
import type { GlyphGroup } from '@coderline/alphatab/rendering/glyphs/GlyphGroup';
import { ScoreRenderer } from '@coderline/alphatab/rendering/ScoreRenderer';
import { Settings } from '@coderline/alphatab/Settings';
import { describe, expect, it } from 'vitest';

describe('IncompleteBarTrailingSpace', () => {
    function render(
        tex: string,
        trailingSpace: number,
        tracks: number[] = [0],
        justify = false,
        svgParts: string[] = []
    ): ScoreRenderer {
        const settings = new Settings();
        settings.core.enableLazyLoading = false;
        settings.display.incompleteBarTrailingSpace = trailingSpace;
        settings.display.lastSystemFillThreshold = justify ? 0 : 1;
        const importer = new AlphaTexImporter();
        importer.init(ByteBuffer.fromString(tex), settings);
        const score = importer.readScore();

        const renderer = new ScoreRenderer(settings);
        renderer.width = 1500;
        renderer.partialRenderFinished.on(e => {
            svgParts.push(String(e.renderResult));
        });
        renderer.renderScore(score, tracks);
        return renderer;
    }

    /** Thin, tall rects in the SVG output: barlines and tab rhythm stems. */
    function verticalLineRanges(svgParts: string[]): { left: number; right: number }[] {
        const ranges: { left: number; right: number }[] = [];
        for (const svg of svgParts) {
            for (const match of svg.matchAll(/<rect x="([^"]+)" y="[^"]+" width="([^"]+)" height="([^"]+)"/g)) {
                const x = Number(match[1]);
                const width = Number(match[2]);
                if (width < 3 && Number(match[3]) > 20) {
                    ranges.push({ left: x, right: x + width });
                }
            }
        }
        return ranges;
    }

    function barWidth(renderer: ScoreRenderer, barIndex: number): number {
        return renderer.boundsLookup!.staffSystems[0].bars[barIndex].visualBounds.w;
    }

    function trailingGap(renderer: ScoreRenderer, barIndex: number, staffIndex = 0): number {
        const bar = renderer.boundsLookup!.staffSystems[0].bars[barIndex].bars[staffIndex];
        const lastBeat = bar.beats[bar.beats.length - 1].visualBounds;
        return bar.visualBounds.x + bar.visualBounds.w - (lastBeat.x + lastBeat.w);
    }

    function barRenderers(renderer: ScoreRenderer, barIndex: number): BarRendererBase[] {
        return renderer.layout!.systems[0].staves.flatMap(group =>
            group.staves.map(staff => staff.barRenderers[barIndex])
        );
    }

    function postBeatWidth(barRenderer: BarRendererBase): number {
        return barRenderer.width - barRenderer.postBeatGlyphsStart;
    }

    function barLineX(barRenderer: BarRendererBase): number | undefined {
        const postBeatGlyphs: GlyphGroup = (barRenderer as any)._postBeatGlyphs;
        return postBeatGlyphs.glyphs?.find(glyph => glyph instanceof BarLineGlyph)?.x;
    }

    const shortSecondBar = `
        \\track \\staff {tabs}
        \\ts 4 4
        :4 3.3 3.3 3.3 3.3 | 3.3 3.3.8
    `;

    it('is disabled by default', () => {
        expect(new Settings().display.incompleteBarTrailingSpace).toBe(0);
    });

    it('reserves the space before the barline of an incomplete bar only', () => {
        const baseline = render(shortSecondBar, 0);
        const spaced = render(shortSecondBar, 40);

        expect(barWidth(spaced, 0)).toBe(barWidth(baseline, 0));
        expect(barWidth(spaced, 1) - barWidth(baseline, 1)).toBe(40);
        expect(trailingGap(spaced, 1) - trailingGap(baseline, 1)).toBe(40);
    });

    it('paints the closing barline after the reserved space', () => {
        const tex = `
            \\track \\staff {tabs}
            \\ts 4 4
            :4 3.3 3.3 3.3 3.3 | 3.3 3.3.8 | :4 3.3 3.3 3.3 3.3
        `;
        const svgParts: string[] = [];
        const renderer = render(tex, 40, [0], false, svgParts);
        const bar = renderer.boundsLookup!.staffSystems[0].bars[1].bars[0];
        const barRight = bar.visualBounds.x + bar.visualBounds.w;
        const lastBeat = bar.beats[bar.beats.length - 1].visualBounds;
        const lines = verticalLineRanges(svgParts);

        expect(lines.some(line => Math.abs(line.right - barRight) < 0.5)).toBe(true);
        expect(lines.filter(line => line.left > lastBeat.x + lastBeat.w && line.right < barRight - 1)).toEqual([]);
    });

    it('keeps the full space as fixed overhead when the system is justified', () => {
        const baseline = render(shortSecondBar, 0, [0], true);
        const spaced = render(shortSecondBar, 40, [0], true);

        expect(postBeatWidth(barRenderers(spaced, 0)[0])).toBe(postBeatWidth(barRenderers(baseline, 0)[0]));
        expect(postBeatWidth(barRenderers(spaced, 1)[0]) - postBeatWidth(barRenderers(baseline, 1)[0])).toBe(40);
    });

    it('leaves complete, anacrusis and full tuplet bars unchanged', () => {
        const tex = `
            \\track \\staff {tabs}
            \\ts 4 4
            :4 3.3 3.3 3.3 3.3 |
            \\ac :4 3.3 |
            :16 3.3{tu 7} 3.3{tu 7} 3.3{tu 7} 3.3{tu 7} 3.3{tu 7} 3.3{tu 7} 3.3{tu 7} :4 3.3 3.3 3.3
        `;
        const baseline = render(tex, 0);
        const spaced = render(tex, 40);

        for (const barIndex of [0, 1, 2]) {
            expect(barWidth(spaced, barIndex)).toBe(barWidth(baseline, barIndex));
        }
    });

    it('aligns the barlines of every rendered staff when one of them is incomplete', () => {
        const tex = `
            \\track "Short" \\staff {tabs}
            \\ts 4 4
            :4 3.3 3.3 3.3 3.3 | 3.3 3.3.8
            \\track "Complete" \\staff {tabs}
            :4 3.3 3.3 3.3 3.3 | 3.3 3.3 3.3 3.3
        `;
        const baseline = render(tex, 0, [0, 1]);
        const spaced = render(tex, 40, [0, 1]);

        expect(barRenderers(spaced, 1).map(barLineX)).toEqual([40, 40]);
        expect(trailingGap(spaced, 1, 0) - trailingGap(baseline, 1, 0)).toBe(40);
        expect(trailingGap(spaced, 1, 1) - trailingGap(baseline, 1, 1)).toBe(40);
    });
});
