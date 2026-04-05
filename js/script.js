let latestCounts = {};

let tags = [];

const loading = document.getElementById('loading');

let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
// 初期反映
if (isDark) {
    document.body.classList.add('dark-theme');
}
const darkBtn = document.querySelector('#darkBtn');

darkBtn.addEventListener('click', () => {
    isDark = !isDark;
    document.body.classList.toggle('dark-theme', isDark);
    darkBtn.textContent = isDark ? "ライトモード" : "ダークモード";
});

//Dropイベントでファイルを受け取る、再読み込みを防ぐ
const text = document.getElementById('input');
// デフォルト動作を無効化
document.addEventListener('dragover', e => e.preventDefault());
text.addEventListener('dragover', () => {
    text.classList.add('dragover');
});

// ドラッグがエリアから外れた時
text.addEventListener('dragleave', () => {
    text.classList.remove('dragover');
});

// ドロップ時の処理
document.addEventListener('drop', e => e.preventDefault());
text.addEventListener('drop', (e) => {
    e.preventDefault(); // ブラウザがファイルを開くのを防ぐ
    text.classList.remove('dragover');

    // ファイル情報の取得
    const files = e.dataTransfer.files;
    if (files.length > 0) {
    const file = files[0];

    if (file.size > 1_000_000) {
        alert("ファイルが大きすぎます");
        return;
    }
    // ファイルの形式チェック（textファイルのみ）
    const isTxtExt = file.name.toLowerCase().endsWith('.txt');
    const isTextMime = file.type === '' || file.type === 'text/plain';
    if (!isTxtExt || !isTextMime) {
        alert("txtのみ対応しています");
        return;
    }
    if (file.type.indexOf('text') !== -1 || file.name.endsWith('.txt')) {
        const reader = new FileReader();

        // ファイル読み込みが完了した時の処理
        reader.onload = (event) => {
        // テキストエリアに内容を挿入
        text.value = event.target.result;
        };

        // ファイルをテキストとして読み込む
        reader.readAsText(file);
    } else {
        alert('テキストファイルをドロップしてください。');
    }
    //console.log(text);
    }
});


//クレンジング、正規表現で文字列、数字をunicode指定してそれ以外は空白に置き換える
const presets = {
  words: /[^\p{L}\p{N}]+/gu,
  numbers: /[^\d]+/g,
  hiragana: /[^\p{Script=Hiragana}]+/gu
};

const clearBtn = document.getElementById('clearBtn');
clearBtn.addEventListener('click', () => {
    // textareaの値を空にする
    text.value = '';
    return;
});

const downloadBtn = document.getElementById('downloadBtn');
downloadBtn.disabled = true;

const exclude = document.getElementById("exclude");
      
const addBtn = document.getElementById('addBtn');
const tagDisplay = document.getElementById('tagDisplay');

function addTag() {
    const tagText = exclude.value.toLowerCase();
    if (tagText && !tags.includes(tagText)) {
        tags.push(tagText); 
        // 配列に追加
                exclude.value = '';
        renderTags();
    }else{
        const message = document.getElementById('message').textContent = "すでに追加されています";
        setTimeout(() => message.textContent = "", 2000);
    }
}

function renderTags() {
    tagDisplay.innerHTML = ''; // 一旦クリア
    tags.forEach((tag, index) => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag-item';
        tagSpan.innerHTML = `
            ${tag}
            <span class="remove-tag" data-index="${index}">x</span>
        `;
        tagDisplay.appendChild(tagSpan);
    });
}

tagDisplay.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-tag')) {
        const index = e.target.getAttribute('data-index');
        tags.splice(index, 1); 
        // 配列から要素を削除
        renderTags(); // 再描画
    }
});

addBtn.addEventListener('click', addTag);

const worker = new Worker('./js/worker.js');

function analyze() {
    const textValue = text.value.trim();
    //入力バリデーション
    if (!text.value.trim()) {
    alert("入力してください");
    return;
    }
    const mode = document.getElementById("mode").value;
    const granularity = document.getElementById("granularity")?.value || "word";

    loading.textContent = "処理中...";
    loading.classList.add('blink');
    downloadBtn.disabled = true;

    // Workerへデータを送信
    worker.postMessage({
            text: textValue,
            mode: mode,
            granularity: granularity,
            regex: presets[mode], // 正規表現も送る
            excludeTags: tags
    });
}

// Workerからの結果受け取り
worker.onmessage = function(e) {
    const { counts, error } = e.data;
    
    if (error) {
        console.error(error);
        loading.textContent = "エラーが発生しました";
        return;
    }

    renderResults(counts); // 結果描画処理は既存のロジックを流用
};

function renderResults(counts) {
    const result = document.getElementById('result');
    result.innerHTML = "";
    
    const fragment = document.createDocumentFragment();
    const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    sortedEntries.slice(0, 20).forEach(([word, count]) => {
        const li = document.createElement("li");
        li.textContent = `${word} : ${count}`;
        li.addEventListener("click", () => {
            addExclude(word);
            addTag();
            analyze(); // 再解析
        });
        fragment.appendChild(li);
    });

    result.appendChild(fragment);
    
    if (sortedEntries.length === 0) {
        result.innerHTML = "単語が見つかりませんでした";
    } else {
        latestCounts = counts;
        downloadBtn.disabled = false;
    }

    loading.textContent = "";
    loading.classList.remove('blink');
};

function addExclude(word) {
    const excludeInput = document.getElementById("exclude");

const current = [...new Set(
  excludeInput.value
    .split(",")
    .map(w => w.trim())
    .filter(w => w !== "")
)];

if (!current.includes(word)) {
  current.push(word);
}

excludeInput.value = current.join(", ");
}

//CSVダウンロード部分
document.getElementById('downloadBtn').addEventListener('click', () => {
    const rows = Object.entries(latestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

    //出力データExcel数式対策
    const safeRows = rows
    .map(([word, count]) => {
        //演算子除去
        const safeWord = word.replace(/^[=+\-@]/, "'$&");
        return [safeWord, count];
    })
    .filter(([safeWord]) => safeWord.trim() !== "");

    //ヘッダー
    let csvOutput = "word,count\n";

    csvOutput += safeRows
    .map(([safeword, count]) => {
        return `"${safeword}",${count}`;
    }).join("\n");

    //データ互換性
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvOutput], { type: 'text/csv' });
    //ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.csv';
    a.click();
    //メモリ開放
    URL.revokeObjectURL(url);
});