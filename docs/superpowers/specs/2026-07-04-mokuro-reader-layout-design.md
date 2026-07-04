# Mokuro Reader Layout & Analysis Display Simplification

## Goal
Improve the Mokuro Reader so that:
1. The LLM analysis result appears on the right side of the same screen as the manga page (no scrolling to the bottom).
2. The analysis display is simplified, showing only translation, non-beginner vocabulary, and key grammar.

## Current Behavior
- `MokuroReader` renders a two-column layout: left = page viewer, right = OCR Blocks list + Selected Text.
- The full `TextAnalyzer` result is rendered below this layout, forcing the user to scroll down.
- `TextAnalyzer` shows extracted text, translation, summary, and sentence-by-sentence vocabulary/grammar.

## Proposed Changes

### 1. Layout: Move analysis into the right sidebar
- Remove the bottom `<TextAnalyzer analysisResult={activeAnalysis} />` placement in `MokuroReader`.
- In the right sidebar, replace the "Selected Text" card with a new `MokuroAnalysisPanel`.
- The panel shows:
  - The selected Japanese text (small header).
  - Analysis result when available.
  - Loading state while analyzing.
  - Empty prompt when no block is selected.

### 2. New component: `MokuroAnalysisPanel`
Create `src/components/MokuroAnalysisPanel.tsx` that accepts `AnalysisResult | null` and renders:
- **Translation** section: `analysisResult.translation`.
- **Vocabulary** section: words from `analysisResult.sentences[].words` where `difficulty !== 'beginner'` (i.e., keep `intermediate` and `advanced`).
  - Show: word, reading, meaning, part of speech, difficulty badge.
- **Grammar** section: grammar patterns from `analysisResult.sentences[].grammar`.
  - Show: pattern, explanation, example.

### 3. Keep unchanged
- `TextAnalyzer` remains as-is for other analysis modes.
- API routes and AI service are unchanged.
- OCR block selection and `analyzeText` call flow remain unchanged.

## Acceptance Criteria
- [ ] After clicking an OCR block, the analysis result appears in the right sidebar without scrolling.
- [ ] The result panel shows translation, intermediate/advanced vocabulary, and grammar only.
- [ ] Beginner vocabulary is hidden.
- [ ] Loading and empty states are handled.
- [ ] `npm run lint` and `npm run build` pass.
