self.onmessage = function(e) {
    const { text, mode, granularity, regex, excludeTags } = e.data;
    const MAX_WORDS = 10000;
    const counts = {};
    try {
        let tokens = [];

        // --- 1. 分割ロジックの分岐 ---
        if (mode === 'words' || mode === 'numbers' || mode === 'hiragana') {
            // 既存の正規表現クレンジング + 空白分割
            const cleaned = text.replace(regex, " ");
            tokens = cleaned.split(/\s+/);
        } else if (mode === 'segmenter') {
            // Intl.Segmenter を使用 (日本語/英語混在でも対応可能)
            // granularity: 'word' | 'sentence'
            const segmenter = new Intl.Segmenter('ja-JP', { granularity: granularity });
            const segments = segmenter.segment(text);

            for (const { segment, isWordLike } of segments) {
                // wordモードの場合、記号や空白を除外する isWordLike が便利
                if (granularity === 'word' && !isWordLike) continue;
                tokens.push(segment.trim());
            }
        }

        // --- 2. カウント処理 (共通) ---
        let processedCount = 0;
        for (let t of tokens) {
            if (processedCount >= MAX_WORDS) break;
            
            const word = t.toLowerCase();
            if (word.length <= 1) continue;
            if (excludeTags.includes(word)) continue;

            counts[word] = (counts[word] || 0) + 1;
            processedCount++;
        }

        self.postMessage({ counts });
    } catch (err) {
        self.postMessage({ error: err.message });
    }
};