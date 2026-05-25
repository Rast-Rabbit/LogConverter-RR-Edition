// Wrap entire script in an IIFE (Immediately Invoked Function Expression)
(function() {
  "use strict"; // Enable strict mode

  // --- State Variables ---
  let displayLogData = []; // Holds the unified log data being edited
  let characterSettings = {}; // { speakerName: { displayName, icon, expressions, alignment, color, customTextColor, forceNarration, isNew } }
  let customizationSettings = {
      normalBubbleColor: '#ffffff',       // ライト：左向き吹き出し
      darkNormalBubbleColor: '#2d2d2d',    // ダーク：左向き吹き出し
      rightBubbleColor: '#dcf8c6',        // ライト：右向き吹き出し
      darkRightBubbleColor: '#29342f',    // ダーク：右向き吹き出し
      fontSize: 16, backgroundColor: '#f3f4f6',         // ライト：ログ背景
      darkBgColor: 'rgba(0,0,0,0.30)',             // ダーク：ログ背景（半透明ガラス）
      iconSize: 64,
      bubbleMaxWidth: 80,
      fontFamily: 'font-noto-sans', logDisplayHeight: 960,
      skipDeleteConfirm: false,
      baseTextColor: '#333333',           // ライト：基本文字色
      darkBaseTextColor: '#e8e8e8',       // ダーク：基本文字色（Forest Night）
      textEdgeColor: '#ffffff',           // ライト：縁取り色
      darkTextEdgeColor: 'transparent',   // ダーク：縁取りなし
      backgroundImage: null,
      backgroundImageFileName: null,
      includeThemeToggle: false,           // ZIP出力に切り替えボタンを含めない（false=含める）
      speakerAlignmentMode: false,          // true=発言者ごとに表示方向を設定、false=タブごと
      customBubbleColors: [
          { light: '#c6f8f8', dark: '#303044' },
          { light: '#ffd6d6', dark: '#3a2020' }
      ]
   };
  let currentTheme = 'light';

  function getAlignmentOptions() {
      const opts = [['left', '左'], ['right', '右']];
      (customizationSettings.customBubbleColors || []).forEach((_, i) => {
          opts.push([`left-custom-${i+1}`, `左（カスタム${i+1}）`]);
          opts.push([`right-custom-${i+1}`, `右（カスタム${i+1}）`]);
      });
      return opts;
  }
  function isRightAlignment(alignment) {
      return alignment === 'right' || (!!alignment && alignment.startsWith('right-custom-'));
  }
  function getBubbleColorForAlignment(alignment) {
      const isDark = currentTheme === 'dark';
      const m = alignment && alignment.match(/^(?:left|right)-custom-(\d+)$/);
      if (m) {
          const idx = parseInt(m[1]) - 1;
          const custom = (customizationSettings.customBubbleColors || [])[idx];
          if (custom) return isDark ? custom.dark : custom.light;
      }
      if (isRightAlignment(alignment))
          return isDark ? customizationSettings.darkRightBubbleColor : customizationSettings.rightBubbleColor;
      return isDark ? customizationSettings.darkNormalBubbleColor : customizationSettings.normalBubbleColor;
  }

  let bulkMoveMode = false;
  let bulkMoveSelected = []; // item IDs in selection order

   let currentTabFilter = 'all';
   let currentSpeakerFilter = 'all';
   let visibleTabsInAllMode = new Set();
   let uploadedFiles = {}; // key: File object (or Blob) for icons, images, background
   let isProcessingFile = false;
   let speakerFrequencies = {}; // For log-derived speakers
   let imageInsertTarget = { type: null, itemId: null };
   let actionTargetItemId = null; // For add chat/heading actions
   let nextUniqueId = 0;
   let logFileNameBase = 'session_log';
   let uniqueTabsFound = new Set();
   let tabSettings = {}; // { tabName: { alignment: 'left' | 'right' } }
   let speakerDataForExport = {};
   let messageIconChangeTargetId = null;
   let currentDropdown = null;
   let expressionAddContext = { speaker: null, inputElement: null };
   let isHeadingsNavOpen = false;
   let isRenderingLog = false;
   let speakerFilenameAlias = {}; // { "アリス": "char_0" }
   let nextAliasId = 0;
   let expressionAliasMap = {}; // { "アリス": { "笑顔": "emote_0" } }
   let nextExpressionAliasId = 0;
   let resizePerfResetTimer = null;
   let resizePerfRafId = null;
   let applyIconToSubsequent = false; // ページ内共通トグル：以降の全アイコンを変更するか


   // Project file constants
   const PROJECT_FILE_EXTENSION = '.cclogproj';
   const PROJECT_DATA_FILENAME = 'project_data.json';
   const PROJECT_IMAGES_FOLDER = 'images/';
   const PROJECT_FILE_FORMAT_VERSION = '1.6'; // Updated version for new features
   const APP_VERSION = '11.0-narration-filter'; // Updated version

  // --- DOM Elements ---
  const cocofoliaFileInput = document.getElementById('cocofolia-log-input');
  const udonariumFileInput = document.getElementById('udonarium-log-input');
  const tekeyFileInput = document.getElementById('tekey-log-input');
  const projectLoadInput = document.getElementById('project-load-input');
  const fileInfoSpan = document.getElementById('file-info');
  const projectLoadInfoSpan = document.getElementById('project-load-info');
  const characterSettingsDiv = document.getElementById('character-settings');
  const logTabsNav = document.getElementById('log-tabs');
  const speakerFilterSelect = document.getElementById('speaker-filter');
  const allModeTabFilterDiv = document.getElementById('all-mode-tab-filter');
  const logDisplayDiv = document.getElementById('log-display');
  const exportButton = document.getElementById('export-zip-button');
  const exportHtmlButton = document.getElementById('export-html-button');
  const saveProjectButton = document.getElementById('save-project-button');
  const loadingOverlay = document.getElementById('loading-overlay');
  const settingsTabButton = document.getElementById('tab-btn-settings');
  const characterTabButton = document.getElementById('tab-btn-character');
  const customizeTabButton = document.getElementById('tab-btn-customize');
  const settingsPanel = document.getElementById('settings-panel-tab');
  const characterPanel = document.getElementById('settings-panel-character');
  const customizePanel = document.getElementById('settings-panel-customize');
  const normalColorInput = document.getElementById('bubble-normal-color');
  const rightBubbleColorInput = document.getElementById('bubble-right-color');
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeValueSpan = document.getElementById('font-size-value');
  const backgroundColorInput = document.getElementById('background-color');
  const iconSizeSlider = document.getElementById('icon-size-slider');
  const iconSizeValueSpan = document.getElementById('icon-size-value');
  const bubbleWidthSlider = document.getElementById('bubble-width-slider');
  const bubbleWidthValueSpan = document.getElementById('bubble-width-value');
  const fontFamilySelect = document.getElementById('font-family-select');
  const resetCustomizationButton = document.getElementById('reset-customization');
  const insertImageInput = document.getElementById('insert-image-input');
  const exportHtmlTitleInput = document.getElementById('export-html-title');
  const exportZipFilenameInput = document.getElementById('export-zip-filename');
  const logHeightSlider = document.getElementById('log-height-slider');
  const logHeightValueSpan = document.getElementById('log-height-value');
  const iconChangeInput = document.getElementById('message-icon-change-input');
  const iconSelectDropdown = document.getElementById('icon-select-dropdown');
  const bulkMoveButton = document.getElementById('bulk-move-button');
  const skipDeleteConfirmToggle = document.getElementById('skip-delete-confirm-toggle');
  const addNewCharacterButton = document.getElementById('add-new-character-button');
  const addNewTabButton = document.getElementById('add-new-tab-button');
  const baseTextColorInput = document.getElementById('base-text-color');
  const textEdgeColorInput = document.getElementById('text-edge-color-input');
  const backgroundImageInput = document.getElementById('background-image-input');
  const backgroundImagePreview = document.getElementById('background-image-preview');
  const clearBackgroundImageButton = document.getElementById('clear-background-image-button');
  const darkNormalColorInput = document.getElementById('dark-normal-bubble-color');
  const darkRightColorInput  = document.getElementById('dark-right-bubble-color');
  const darkBgColorInput     = document.getElementById('dark-bg-color');
  const darkBaseTextColorInput = document.getElementById('dark-base-text-color');
  const darkTextEdgeColorInput = document.getElementById('dark-text-edge-color');
  const includeThemeToggleInput = document.getElementById('include-theme-toggle');
  const speakerAlignmentModeToggle = document.getElementById('speaker-alignment-mode-toggle');


  const headingsNavPanel = document.getElementById('headings-nav-panel');
  const toggleHeadingsNavBtn = document.getElementById('toggle-headings-nav-btn');
  const headingsListUl = document.getElementById('headings-list');

  const genericModal = document.getElementById('generic-modal');
  const genericModalTitle = document.getElementById('generic-modal-title');
  const genericModalBody = document.getElementById('generic-modal-body');
  const genericModalConfirmBtn = document.getElementById('generic-modal-confirm-btn');
  const genericModalCancelBtn = document.getElementById('generic-modal-cancel-btn');
  const genericModalCloseBtn = document.getElementById('generic-modal-close-btn');
  const newCharIconModalInput = document.getElementById('new-char-icon-modal-input');

  const PLACEHOLDER_ICON_URL = 'https://placehold.co/64x64/e0e0e0/757575?text=?';
  const LOCALSTORAGE_CUSTOMIZATION_KEY = 'logToolCustomization_v10.5';
  const FONT_CLASSES = [
       'font-inter', 'font-noto-sans', 'font-noto-serif',
       'font-mplus-rounded', 'font-system-sans', 'font-system-serif',
       'font-system-mono'
  ];
  const MAX_FILE_SIZE_MB = 5;
  const MAX_INSERT_IMAGE_SIZE_MB = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const MAX_INSERT_IMAGE_SIZE_BYTES = MAX_INSERT_IMAGE_SIZE_MB * 1024 * 1024;
  const HEADER_IMAGE_ANCHOR = 'header_image_anchor';
  const BACKGROUND_IMAGE_KEY = 'bg_image';
  const RENDER_CHUNK_SIZE = 50;
  const RENDER_CHUNK_DELAY = 0;
  const HTML_EXPORT_DARK_SOLID_BG = '#253041';
  const SINGLE_FILE_IMAGE_PLACEHOLDER_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  function escapeHtml(unsafe) { if (typeof unsafe !== 'string') return ''; return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

  // ZIP・HTML出力時のみ適用するマークダウン変換
  // エスケープ: \| \** \~~ \[ で変換を抑制
  function parseMarkdownForExport(text) {
      if (!text) return text;
      return text
          .replace(/\\\|/g,    '\x01PIPE\x01')
          .replace(/\\\*\*/g,  '\x01DSTR\x01')
          .replace(/\\~~/g,    '\x01DTLD\x01')
          .replace(/\\\[/g,    '\x01LBRK\x01')
          .replace(/\|([^《\n]+?)《([^》\n]+?)》/g, '<ruby>$1<rt>$2</rt></ruby>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/~~(.+?)~~/g, '<del>$1</del>')
          .replace(/\[([^\]\n]+?)\]\((https?:\/\/[^\)\n]+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
          .replace(/\x01PIPE\x01/g, '|')
          .replace(/\x01DSTR\x01/g, '**')
          .replace(/\x01DTLD\x01/g, '~~')
          .replace(/\x01LBRK\x01/g, '[');
  }

  function escapeCssSelector(str) { if (!str) return ''; return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1'); }
  function showLoading() { if (loadingOverlay) { loadingOverlay.classList.add('visible'); loadingOverlay.setAttribute('aria-hidden', 'false'); } }
  function hideLoading() { if (loadingOverlay) { loadingOverlay.classList.remove('visible'); loadingOverlay.setAttribute('aria-hidden', 'true'); } }
  function readFileAsText(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error || new Error(`Failed to read file: ${file.name}`)); reader.readAsText(file, 'UTF-8'); }); }
  function readFileAsDataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error || new Error(`Failed to read file as Data URL: ${file.name}`)); reader.readAsDataURL(file); }); }
  function generateUniqueId(prefix = 'item') { return `${prefix}_${nextUniqueId++}`; }
  function generateBaseFilename(filename) {
      if (!filename) return 'session_log';
      let base = filename.replace(/\.[^/.]+$/, "");
      base = base.replace(/\[.*?\]/g, '').replace(/\(all\)/i, '').trim();
      base = base.replace(/[\\/:*?"<>|]/g, '_');
      return base || 'session_log';
  }
  function sanitizeForFilename(name) {
       if (!name) return '';
       // Alphanumeric, hyphen, underscore only.
       const sanitized = String(name).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
       return sanitized.replace(/_+/g, '_');
  }

  function getImagePathForKey(key, fileObject) {
      if (!fileObject || !(fileObject instanceof Blob)) { console.warn(`getImagePathForKey: Invalid fileObject for key ${key}`); return null; }
      let outputFilename = null;
      const fileExtension = fileObject.name?.split('.').pop()?.toLowerCase() || 'png';

      if (key === BACKGROUND_IMAGE_KEY) {
          const safeName = sanitizeForFilename(customizationSettings.backgroundImageFileName || 'background');
          outputFilename = `${safeName}.${fileExtension}`;
      } else if (key.startsWith('img_')) {
          const safeKeyBase = sanitizeForFilename(key);
          outputFilename = `${safeKeyBase}.${fileExtension}`;
      } else if (key.startsWith('icon_msg_')) {
          const msgIdPart = key.substring(9);
          const safeMsgIdPart = sanitizeForFilename(msgIdPart);
          outputFilename = `${safeMsgIdPart}_override.${fileExtension}`;
      } else if (key.startsWith('exp_')) {
          const parts = key.match(/^exp_(.+?)_(.+)$/);
          if (parts && parts.length === 3) {
              const speakerName = parts[1];
              const expName = parts[2];
              const speakerAlias = speakerFilenameAlias[speakerName] || sanitizeForFilename(speakerName);
              const expressionAlias = (expressionAliasMap[speakerName] && expressionAliasMap[speakerName][expName])
                                      ? expressionAliasMap[speakerName][expName]
                                      : sanitizeForFilename(expName);
              outputFilename = `${speakerAlias}_${expressionAlias}.${fileExtension}`;
          }
      } else if (key.startsWith('newchar_')) {
          const speakerName = key.substring(8);
          const speakerAlias = speakerFilenameAlias[speakerName] || sanitizeForFilename(speakerName);
          outputFilename = `${speakerAlias}_icon.${fileExtension}`;
      } else {
          const speakerName = key;
          const speakerAlias = speakerFilenameAlias[speakerName] || sanitizeForFilename(speakerName);
          outputFilename = `${speakerAlias}_icon.${fileExtension}`;
      }
      return outputFilename ? `${PROJECT_IMAGES_FOLDER}${outputFilename}` : null;
  }

  function createFileFromBlob(blob, filename) { try { return new File([blob], filename, { type: blob.type || 'application/octet-stream', lastModified: Date.now() }); } catch (e) { console.warn("File constructor failed, creating simple Blob with name property.", e); try { blob.name = filename; blob.lastModifiedDate = new Date(); return blob; } catch (blobError){ console.error("Could not create File or add name to Blob.", blobError); return null; } } }

  function startFileProcessing(file, logTypeLabel) {
      if (isProcessingFile) { console.warn("Processing already in progress."); return false; }
      isProcessingFile = true;
      fileInfoSpan.textContent = `読込中 (${logTypeLabel}): ${escapeHtml(file.name)}...`;
      projectLoadInfoSpan.textContent = '';
      showLoading();
      resetAppState();
      logFileNameBase = generateBaseFilename(file.name);
      exportHtmlTitleInput.value = logFileNameBase;
      exportZipFilenameInput.value = logFileNameBase;
      return true;
  }

  function endFileProcessing(file, success, errorMessage) {
      hideLoading();
      isProcessingFile = false;
      if (success) {
          fileInfoSpan.textContent = `読込完了: ${escapeHtml(file.name)} (${displayLogData.filter(i => i.type === 'message' || i.type === 'error').length}件)`;
          enableControls();
      } else {
          console.error(`Error during file processing:`, errorMessage);
          alert(`処理中にエラーが発生しました: ${errorMessage}`);
          fileInfoSpan.textContent = '処理エラーが発生しました';
          logDisplayDiv.innerHTML = '<p class="text-red-500 text-center font-semibold">ログの処理中にエラーが発生しました。</p>';
          disableControls();
          resetAppState();
      }
      if (cocofoliaFileInput) cocofoliaFileInput.value = null;
      if (udonariumFileInput) udonariumFileInput.value = null;
      if (tekeyFileInput) tekeyFileInput.value = null;
      resetCustomizationDefaults();
      updateCustomizationUI();
  }

  async function handleCocofoliaFileSelect(event) {
      const file = event.target.files?.[0];
      if (!file) { fileInfoSpan.textContent = 'ファイルが選択されていません'; return; }
      if (!file.name.toLowerCase().endsWith('.html')) { alert('ココフォリアHTMLファイルを選択してください。'); fileInfoSpan.textContent = 'HTMLファイルを選択してください'; event.target.value = null; return; }
      if (!startFileProcessing(file, "ココフォリア")) { event.target.value = null; return; }
      let success = false; let errorMessage = '';
      try {
          const fileContent = await readFileAsText(file);
          if (!fileContent || fileContent.trim().length === 0) throw new Error("ファイルが空か、内容を読み取れませんでした。");
          await new Promise(resolve => setTimeout(resolve, 50));
          const parsedData = parseCocofoliaLogHtml(fileContent);
          initializeAfterParse(parsedData);
          success = true;
      } catch (error) { errorMessage = error.message || '不明なエラー'; success = false; }
      finally { endFileProcessing(file, success, errorMessage); }
  }

  async function handleTekeyFileSelect(event) {
      const file = event.target.files?.[0];
      if (!file) { fileInfoSpan.textContent = 'ファイルが選択されていません'; return; }
      if (!file.name.toLowerCase().endsWith('.html')) { alert('Tekey HTMLファイルを選択してください。'); fileInfoSpan.textContent = 'HTMLファイルを選択してください'; event.target.value = null; return; }
      if (!startFileProcessing(file, "Tekey")) { event.target.value = null; return; }
      let success = false; let errorMessage = '';
      try {
          const fileContent = await readFileAsText(file);
          if (!fileContent || fileContent.trim().length === 0) throw new Error("ファイルが空か、内容を読み取れませんでした。");
          await new Promise(resolve => setTimeout(resolve, 50));
          const parsedData = parseTekeyLogHtml(fileContent);
          initializeAfterParse(parsedData);
          success = true;
      } catch (error) { errorMessage = error.message || '不明なエラー'; success = false; }
      finally { endFileProcessing(file, success, errorMessage); }
  }

  // ==================== ユドナリウムZIPインポート ====================

  async function handleUdonariumFileSelect(event) {
      const file = event.target.files?.[0];
      if (!file) { fileInfoSpan.textContent = 'ファイルが選択されていません'; return; }
      if (!file.name.toLowerCase().endsWith('.zip')) {
          alert('ユドナリウムのZIPファイルを選択してください。');
          fileInfoSpan.textContent = 'ZIPファイルを選択してください';
          event.target.value = null; return;
      }
      if (!startFileProcessing(file, "ユドナリウム")) { event.target.value = null; return; }
      let success = false; let errorMessage = '';
      try {
          const { messages, characterDataByName } = await parseUdonariumZip(file);

          // キャラクター設定を事前投入（チャットベースで構築済みのデータを適用）
          for (const [name, charData] of characterDataByName) {
              if (name === 'システム') continue; // 後で固定設定を投入するのでスキップ
              if (!characterSettings[name]) {
                  characterSettings[name] = {
                      displayName: name,
                      icon: charData.defaultIcon,
                      expressions: {},
                      alignment: 'left',
                      color: charData.color,
                      customTextColor: null,
                      forceNarration: false,
                      isNew: false
                  };
                  // デフォルトアイコンをBlobとしてuploadedFilesに登録（saveProject/エクスポートで参照される）
                  if (charData.defaultIcon) {
                      uploadedFiles[name] = await fetch(charData.defaultIcon).then(r => r.blob());
                  }
              } else {
                  if (!characterSettings[name].icon && charData.defaultIcon) {
                      characterSettings[name].icon = charData.defaultIcon;
                      const uploadKey = characterSettings[name].isNew ? `newchar_${name}` : name;
                      uploadedFiles[uploadKey] = await fetch(charData.defaultIcon).then(r => r.blob());
                  }
                  if (!characterSettings[name].color || characterSettings[name].color === '#000000') {
                      characterSettings[name].color = charData.color;
                  }
              }
              const setting = characterSettings[name];
              for (const [, expInfo] of charData.expressionsByHash) {
                  if (expInfo.dataUrl && !setting.expressions[expInfo.label]) {
                      setting.expressions[expInfo.label] = expInfo.dataUrl;
                      const expKey = `exp_${name}_${expInfo.label}`;
                      uploadedFiles[expKey] = await fetch(expInfo.dataUrl).then(r => r.blob());
                      if (!expressionAliasMap[name]) expressionAliasMap[name] = {};
                      if (!expressionAliasMap[name][expInfo.label]) {
                          expressionAliasMap[name][expInfo.label] = `emote_${nextExpressionAliasId++}`;
                      }
                  }
              }
          }

          // システムメッセージ専用のキャラクター設定（常に地の文・アイコンなし・デフォルト色）
          characterSettings['システム'] = {
              displayName: 'システム',
              icon: null,
              expressions: {},
              alignment: 'left',
              color: '#000000',
              customTextColor: null,
              forceNarration: true,
              isNew: false
          };

          await new Promise(resolve => setTimeout(resolve, 50));
          initializeAfterParse(messages);

          // imageIdentifier に基づいて iconKey を後付け設定
          displayLogData.forEach(item => {
              if (item.type !== 'message') return;
              const imageId = item._udonariumImageId;
              delete item._udonariumImageId;
              if (!imageId || imageId === 'none_icon') return; // 'default' のまま
              const charData = characterDataByName.get(item.speaker);
              if (!charData || imageId === charData.defaultHash) return; // デフォルトアイコンはそのまま
              const expInfo = charData.expressionsByHash.get(imageId);
              if (expInfo?.label && characterSettings[item.speaker]?.expressions?.[expInfo.label]) {
                  item.iconKey = expInfo.label;
              }
          });
          renderLog();

          success = true;
      } catch (error) { errorMessage = error.message || '不明なエラー'; success = false; }
      finally { endFileProcessing(file, success, errorMessage); }
  }

  // バリアント判別
  function detectUdonariumVariant(zip) {
      if (zip.files['fly_data.xml'])  return 'fly';
      if (zip.files['imagetag.xml'])  return 'lily';
      if (zip.files['data.xml'])      return 'standard';
      return null;
  }

  function getUdonariumXmlFilenames(variant) {
      if (variant === 'fly') return { data: 'fly_data.xml', chat: 'fly_chat.xml' };
      return { data: 'data.xml', chat: 'chat.xml' };
  }

  // ZIP内の全画像を base64 DataURL に変換してキャッシュ
  async function buildUdonariumImageCache(zip) {
      const cache = new Map();
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      for (const [filename, zipObj] of Object.entries(zip.files)) {
          if (zipObj.dir) continue;
          const basename = filename.split('/').pop();
          const lower = basename.toLowerCase();
          const ext = imageExts.find(e => lower.endsWith('.' + e));
          if (!ext) continue;
          const hash = basename.replace(/\.[^.]+$/, '');
          const base64 = await zipObj.async('base64');
          cache.set(hash, `data:image/${ext};base64,${base64}`);
      }
      return cache;
  }

  // data.xml からキャラ名ごとの詳細データを構築
  // charDataMap: name → { pos0Hash, allImages: [{hash, label}], color }
  function buildUdonariumCharDataMap(dataDoc) {
      const charDataMap = new Map();
      if (!dataDoc) return charDataMap;
      for (const charEl of dataDoc.querySelectorAll('character')) {
          const nameEl = charEl.querySelector('data[name="character"] > data[name="common"] > data[name="name"]');
          const name = nameEl?.textContent.trim();
          if (!name) continue;
          const color0 = charEl.getAttribute('chatColorCode.0') || null;
          const allImages = [];
          const imageSection = charEl.querySelector('data[name="character"] > data[name="image"]');
          if (imageSection) {
              for (const imgEl of imageSection.querySelectorAll(':scope > data[type="image"][name="imageIdentifier"]')) {
                  const hash  = imgEl.textContent.trim();
                  const label = imgEl.getAttribute('currentValue') || null;
                  if (hash) allImages.push({ hash, label });
              }
          }
          // 同名コマが複数ある場合は最初のものを優先
          if (!charDataMap.has(name)) {
              charDataMap.set(name, { pos0Hash: allImages[0]?.hash || null, allImages, color: color0 });
          }
      }
      return charDataMap;
  }

  // メインパーサー（チャットベースでキャラクター情報を構築）
  async function parseUdonariumZip(file) {
      const zip = await window.JSZip.loadAsync(file);
      const variant = detectUdonariumVariant(zip);
      if (!variant) throw new Error('ユドナリウムのZIPファイルではありません（data.xml / fly_data.xml が見つかりません）。');
      const { data: dataFilename, chat: chatFilename } = getUdonariumXmlFilenames(variant);

      const chatXmlStr = await zip.files[chatFilename]?.async('string');
      if (!chatXmlStr) throw new Error(`${chatFilename} が見つかりませんでした。`);
      const dataXmlStr = await zip.files[dataFilename]?.async('string');

      const parser = new DOMParser();
      const chatDoc = parser.parseFromString(chatXmlStr, 'text/xml');
      const dataDoc = dataXmlStr ? parser.parseFromString(dataXmlStr, 'text/xml') : null;

      const imageCache     = await buildUdonariumImageCache(zip);
      const charDataMap    = buildUdonariumCharDataMap(dataDoc);

      // ── Step 1: チャット全メッセージを収集 ──
      const rawMessages = [];
      for (const tabEl of chatDoc.querySelectorAll('chat-tab')) {
          const tabName = tabEl.getAttribute('name') || 'メインタブ';
          for (const node of tabEl.querySelectorAll(':scope > chat')) {
              const isSystem = node.getAttribute('tag') === 'system';
              const name    = isSystem ? 'システム' : (node.getAttribute('name') || '不明');
              const color   = node.getAttribute('messColor') || '#000000';
              const ts      = parseInt(node.getAttribute('timestamp') || '0', 10);
              const imageId = node.getAttribute('imageIdentifier') || '';
              const text    = node.textContent || '';
              if (!text.trim()) continue;
              rawMessages.push({ name, color, ts, imageId, tab: tabName, text });
          }
      }
      rawMessages.sort((a, b) => a.ts - b.ts);

      // ── Step 2: 発言者ごとの imageIdentifier 使用統計を収集 ──
      const speakerInfo = new Map(); // name → { chatImageIds: Set<hash>, firstColor }
      for (const msg of rawMessages) {
          if (!speakerInfo.has(msg.name)) {
              speakerInfo.set(msg.name, { chatImageIds: new Set(), firstColor: msg.color });
          }
          const si = speakerInfo.get(msg.name);
          if (msg.imageId && msg.imageId !== 'none_icon') {
              si.chatImageIds.add(msg.imageId);
          }
      }

      // ── Step 3: 発言者ごとにキャラクターデータを構築 ──
      // characterDataByName: name → { defaultHash, defaultIcon, expressionsByHash: Map<hash,{label,dataUrl}>, color }
      const characterDataByName = new Map();
      for (const [name, si] of speakerInfo) {
          const koma = charDataMap.get(name) || null;

          // デフォルトアイコン: コマの imagePos=0 優先、コマなし→チャット最頻出
          let defaultHash = koma?.pos0Hash || null;
          if (!defaultHash) {
              // 最頻出は rawMessages で数える
              const freq = new Map();
              for (const msg of rawMessages) {
                  if (msg.name === name && msg.imageId && msg.imageId !== 'none_icon') {
                      freq.set(msg.imageId, (freq.get(msg.imageId) || 0) + 1);
                  }
              }
              let maxCount = 0;
              for (const [hash, count] of freq) {
                  if (count > maxCount) { maxCount = count; defaultHash = hash; }
              }
          }

          const expressionsByHash = new Map(); // hash → { label, dataUrl }
          const usedLabels = new Set();
          let autoCounter  = 1;

          // フェーズA: コマの表情差分を全登録（imagePos=1 以降）
          if (koma) {
              const komaHashSet = new Set(koma.allImages.map(i => i.hash));
              for (let i = 1; i < koma.allImages.length; i++) {
                  const { hash, label: rawLabel } = koma.allImages[i];
                  if (!hash || hash === 'none_icon') continue;
                  let label = rawLabel || null;
                  if (!label) {
                      do { label = `表情${autoCounter++}`; } while (usedLabels.has(label));
                  } else if (usedLabels.has(label)) {
                      let n = 2; while (usedLabels.has(`${label}${n}`)) n++;
                      label = `${label}${n}`;
                  }
                  usedLabels.add(label);
                  expressionsByHash.set(hash, { label, dataUrl: imageCache.get(hash) || null });
              }

              // フェーズB: チャット限定の imageIdentifier（コマに含まれないもの）を追加
              for (const hash of si.chatImageIds) {
                  if (hash === defaultHash) continue;
                  if (komaHashSet.has(hash)) continue; // コマ済み
                  let label;
                  do { label = `表情${autoCounter++}`; } while (usedLabels.has(label));
                  usedLabels.add(label);
                  expressionsByHash.set(hash, { label, dataUrl: imageCache.get(hash) || null });
              }
          } else {
              // コマなし: チャットに登場した imageIdentifier のみ自動生成
              for (const hash of si.chatImageIds) {
                  if (hash === defaultHash) continue;
                  let label;
                  do { label = `表情${autoCounter++}`; } while (usedLabels.has(label));
                  usedLabels.add(label);
                  expressionsByHash.set(hash, { label, dataUrl: imageCache.get(hash) || null });
              }
          }

          // 色: コマの chatColorCode.0 優先、なければ最初の messColor
          const color = koma?.color || si.firstColor || '#000000';

          characterDataByName.set(name, {
              defaultHash,
              defaultIcon: imageCache.get(defaultHash) || null,
              expressionsByHash,
              color
          });
      }

      // ── Step 4: メッセージ配列を構築（iconKey 解決用に imageId を一時保持） ──
      const messages = rawMessages.map(m => ({
          type: 'message',
          id: generateUniqueId('udon'),
          tab: m.tab,
          speaker: m.name,
          color: m.color,
          message: escapeHtml(m.text).replace(/\n/g, '<br>'),
          _udonariumImageId: m.imageId
      }));

      return { messages, characterDataByName };
  }

  // ==================== / ユドナリウムZIPインポート ====================

  async function handleProjectLoadFile(event) {
      if (isProcessingFile) { console.warn("Processing already in progress."); event.target.value = null; return; }
      const file = event.target.files?.[0];
      if (!file) { projectLoadInfoSpan.textContent = 'ファイルが選択されていません'; return; }
      if (!file.name.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)) { alert(`プロジェクトファイル (${PROJECT_FILE_EXTENSION}) を選択してください。`); projectLoadInfoSpan.textContent = `プロジェクトファイルを選択してください`; event.target.value = null; return; }
      isProcessingFile = true;
      projectLoadInfoSpan.textContent = `プロジェクト読込中: ${escapeHtml(file.name)}...`;
      fileInfoSpan.textContent = ''; showLoading();
      resetAppState();
      let success = false; let errorMessage = '';
      try {
          await loadProject(file);

          renderLog();

          projectLoadInfoSpan.textContent = `プロジェクト読込完了: ${escapeHtml(file.name)}`;
           success = true;
      } catch (error) { errorMessage = error.message || 'プロジェクト読み込みエラー'; success = false; }
      finally {
           hideLoading(); isProcessingFile = false;
           if (projectLoadInput) projectLoadInput.value = null;
           if (success) { enableControls(); }
           else { console.error(`Error loading project:`, errorMessage); alert(`プロジェクトの読み込み中にエラーが発生しました:\n${errorMessage}`); projectLoadInfoSpan.textContent = 'プロジェクト読み込みエラー'; logDisplayDiv.innerHTML = '<p class="text-red-500 text-center font-semibold">プロジェクトの読み込みに失敗しました。</p>'; disableControls(); resetAppState(); }
      }
  }

  function initializeAfterParse(parsedData) {
       speakerFrequencies = {}; uniqueTabsFound = new Set();
       speakerFilenameAlias = {}; nextAliasId = 0;
       expressionAliasMap = {}; nextExpressionAliasId = 0;

       parsedData.forEach(item => {
           if (item.type === 'message') {
               if(item.speaker && item.speaker !== 'system' && item.speaker !== '不明') { speakerFrequencies[item.speaker] = (speakerFrequencies[item.speaker] || 0) + 1; }
               if (item.tab) { uniqueTabsFound.add(item.tab); }
           }
       });
       if (uniqueTabsFound.size > 0 && !uniqueTabsFound.has('all')) uniqueTabsFound.add('all');
       else if (uniqueTabsFound.size === 0) uniqueTabsFound = new Set(['all', 'main']);

       visibleTabsInAllMode = new Set([...uniqueTabsFound].filter(t => t !== 'all'));

       tabSettings = {};
       [...uniqueTabsFound].filter(t => t !== 'all').forEach(tab => {
           tabSettings[tab] = { alignment: 'left' };
       });

       displayLogData = parsedData.map(item => {
           if (item.type === 'message') {
               const initialDisplayMode = (item.speaker === 'system') ? 'narration' : 'bubble';
               return { ...item, displayMode: initialDisplayMode, iconKey: 'default', overrideIconSrc: null };
           }
           return item;
       });
       initializeCharacterSettings();

       const allKnownSpeakers = new Set([...Object.keys(speakerFrequencies), ...Object.keys(characterSettings)]);
       allKnownSpeakers.forEach(speaker => {
           if (speaker !== 'system' && speaker !== '不明' && !speakerFilenameAlias[speaker]) {
               if (/^[a-zA-Z0-9_]+$/.test(speaker)) {
                   speakerFilenameAlias[speaker] = speaker;
               } else {
                   speakerFilenameAlias[speaker] = `char_${nextAliasId++}`;
               }
           }
       });

       updateSpeakerDataForExport();
       populateCharacterSettingsUI();
       populateTabsUI();
       populateTabSettingsUI();
       populateSpeakerFilterUI();
       updateCustomizationUI();
       renderLog();
   }

  function resetAppState() {
       displayLogData = []; characterSettings = {};
       resetCustomizationDefaults();
       currentTabFilter = 'all'; currentSpeakerFilter = 'all'; uploadedFiles = {};
       speakerFrequencies = {}; uniqueTabsFound = new Set(['all']); visibleTabsInAllMode = new Set();
       nextUniqueId = 0; imageInsertTarget = { type: null, itemId: null}; actionTargetItemId = null; speakerDataForExport = {}; tabSettings = {};
       messageIconChangeTargetId = null; expressionAddContext = { speaker: null, inputElement: null };
       logFileNameBase = 'session_log'; exportHtmlTitleInput.value = logFileNameBase; exportZipFilenameInput.value = logFileNameBase;
       projectLoadInfoSpan.textContent = ''; fileInfoSpan.textContent = 'ファイルが選択されていません';
       characterSettingsDiv.innerHTML = '<p class="text-gray-500 italic">ログファイルまたはプロジェクトファイルを読み込むと表示されます。</p>';
       logTabsNav.innerHTML = '<span class="whitespace-nowrap py-2 px-1 text-gray-500 text-sm italic">ログ読込中</span>';
       allModeTabFilterDiv.innerHTML = ''; allModeTabFilterDiv.classList.add('hidden');
       speakerFilterSelect.innerHTML = '<option value="all">すべての発言者</option>';
       logDisplayDiv.innerHTML = '<p class="text-gray-500 text-center italic">ここに整形されたログが表示されます。</p>';
       speakerFilenameAlias = {}; nextAliasId = 0;
       expressionAliasMap = {}; nextExpressionAliasId = 0;
       updateCustomizationUI();
       disableControls(); updateHeadingsNav(); closeHeadingsNav();
       if (iconChangeInput) iconChangeInput.value = null; if (insertImageInput) insertImageInput.value = null;
       if (backgroundImageInput) backgroundImageInput.value = null;
       if (cocofoliaFileInput) cocofoliaFileInput.value = null; if (udonariumFileInput) udonariumFileInput.value = null; if (tekeyFileInput) tekeyFileInput.value = null; if (projectLoadInput) projectLoadInput.value = null;
       closeIconDropdown(); closeModal(genericModal);
  }

  function enableControls() {
       exportButton.disabled = false; if (exportHtmlButton) exportHtmlButton.disabled = false; saveProjectButton.disabled = false;
       speakerFilterSelect.disabled = Object.keys(speakerFrequencies).length === 0 && Object.keys(characterSettings).filter(s => !speakerFrequencies[s]).length === 0;
       exportHtmlTitleInput.disabled = false; exportZipFilenameInput.disabled = false; bulkMoveButton.disabled = false; addNewCharacterButton.disabled = false; if (addNewTabButton) addNewTabButton.disabled = false;
  }
  function disableControls() {
      exportButton.disabled = true; if (exportHtmlButton) exportHtmlButton.disabled = true; saveProjectButton.disabled = true;
      speakerFilterSelect.disabled = true; exportHtmlTitleInput.disabled = true; exportZipFilenameInput.disabled = true; bulkMoveButton.disabled = true; addNewCharacterButton.disabled = true; if (addNewTabButton) addNewTabButton.disabled = true;
  }

  function parseCocofoliaLogHtml(htmlContent) {
      const parser = new DOMParser(); const doc = parser.parseFromString(htmlContent, 'text/html');
      if (!doc || !doc.body) throw new Error("ココフォリアHTMLコンテンツの解析に失敗しました。");
      const paragraphs = doc.body.querySelectorAll('p'); const tempData = [];
      paragraphs.forEach((p) => {
          if (!p.textContent?.trim()) return;
          try {
              const spans = p.querySelectorAll('span');
              if (spans.length >= 3) {
                  const tabMatch = spans[0]?.textContent?.match(/\[(.*?)\]/);
                  const tab = tabMatch?.[1]?.trim() || 'main';
                  const speaker = spans[1]?.textContent?.trim().replace(/[:：]$/, '').trim() || '不明';
                  const message = spans[2]?.innerHTML?.trim() ?? '';
                  const colorMatch = p.getAttribute('style')?.match(/color:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|[a-zA-Z]+)/);
                  const color = colorMatch?.[1]?.trim() || '#000000';
                  tempData.push({
                      type: 'message', id: generateUniqueId('msg'),
                      tab: tab, speaker: speaker, color: color, message: message
                  });
              }
          } catch (parseError) {
              tempData.push({ type: 'error', id: generateUniqueId('err'), message: `ログの解析エラー`, details: p.textContent?.substring(0, 100) || '内容不明' });
          }
      });
      return tempData;
  }

  function parseTekeyLogHtml(htmlContent) {
      const parser = new DOMParser(); const doc = parser.parseFromString(htmlContent, 'text/html');
      const chatlogDiv = doc.querySelector('.chatlog');
      if (!chatlogDiv) throw new Error("Tekeyログの '.chatlog' 要素が見つかりませんでした。Tekey v2形式か確認してください。");
      const tabNameMap = {}; const tabLabels = doc.querySelectorAll('.tab-list label.tab-checkbox');
      tabLabels.forEach(label => {
          const input = label.querySelector('input[id^="tab"]'); if (input && input.id) { let tabName = ''; label.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) tabName += node.textContent; }); tabName = tabName.trim(); if (tabName) tabNameMap[input.id] = tabName; else { const fallbackName = label.textContent.trim(); if(fallbackName) tabNameMap[input.id] = fallbackName; else tabNameMap[input.id] = input.id; } }
      });
      if (Object.keys(tabNameMap).length === 0) {
          tabNameMap['tab1'] = 'main';
      }
      const messageDivs = chatlogDiv.querySelectorAll(':scope > div'); const tempData = [];
      messageDivs.forEach((div) => {
          if (!div.textContent?.trim()) return;
          try {
              let tabId = 'tab1';
              // Allow more tabs for Tekey
              const tabClasses = Array.from({length: 20}, (_, i) => `tab${i + 1}`);
              for (const tc of tabClasses) {
                  if (div.classList.contains(tc)) {
                      tabId = tc;
                      break;
                  }
              }
              const tab = tabNameMap[tabId] || tabId;

              const speakerElement = div.querySelector('b'); const speaker = speakerElement?.textContent?.trim().replace(/[:：]$/, '').trim() || '不明';
              const messageContentContainer = div.cloneNode(true);
              const bElementToRemove = messageContentContainer.querySelector('b'); const spanElementToRemove = messageContentContainer.querySelector('span');
              if (bElementToRemove) messageContentContainer.removeChild(bElementToRemove); if (spanElementToRemove) messageContentContainer.removeChild(spanElementToRemove);
              const message = messageContentContainer.innerHTML.trim();
              const colorMatch = div.getAttribute('style')?.match(/color:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|[a-zA-Z]+)/);
              const color = colorMatch?.[1]?.trim() || '#000000';
              const isDiceRoll = div.classList.contains('diceroll');
              tempData.push({
                  type: 'message', id: generateUniqueId('msg'),
                  tab: tab, speaker: speaker, color: color, message: message, isDiceRoll: isDiceRoll
              });
          } catch (parseError) {
              tempData.push({ type: 'error', id: generateUniqueId('err'), message: `Tekeyログの解析エラー`, details: div.textContent?.substring(0, 100) || '内容不明' });
          }
      });
      return tempData;
  }

  function initializeCharacterSettings() {
      const existingSpeakers = new Set(Object.keys(characterSettings));
      Object.keys(speakerFrequencies).forEach(speaker => {
          if (speaker !== 'system' && !characterSettings[speaker]) {
              const firstMessage = displayLogData.find(item => item.type === 'message' && item.speaker === speaker);
              const initialCharColor = firstMessage?.color || '#000000';
              characterSettings[speaker] = {
                  displayName: speaker,
                  icon: null,
                  expressions: {},
                  alignment: 'left',
                  color: initialCharColor,
                  customTextColor: null,
                  forceNarration: false,
                  isNew: false
              };
              existingSpeakers.add(speaker);
          }
      });
      Object.keys(characterSettings).forEach(speaker => {
          if (!characterSettings[speaker].alignment) characterSettings[speaker].alignment = 'left';
          if (!characterSettings[speaker].color) {
               const firstMessage = displayLogData.find(item => item.type === 'message' && item.speaker === speaker);
               characterSettings[speaker].color = firstMessage?.color || '#000000';
          }
          if (typeof characterSettings[speaker].customTextColor === 'undefined') characterSettings[speaker].customTextColor = null;
          if (typeof characterSettings[speaker].forceNarration === 'undefined') characterSettings[speaker].forceNarration = false;
          if (typeof characterSettings[speaker].isNew === 'undefined') characterSettings[speaker].isNew = !speakerFrequencies[speaker];
      });
  }
  function updateSpeakerDataForExport() {
    speakerDataForExport = {};
    Object.entries(characterSettings).forEach(([original, setting]) => {
        if (original !== 'system') {
            speakerDataForExport[original] = {
                displayName: setting.displayName,
                color: setting.color || '#000000',
                customTextColor: setting.customTextColor,
                forceNarration: setting.forceNarration || false
            };
        }
    });
  }


  function populateCharacterSettingsUI() {
      characterSettingsDiv.innerHTML = '';
      const allSpeakers = new Set([...Object.keys(characterSettings).filter(s => s !== 'system'), ...Object.keys(speakerFrequencies).filter(s => s !== 'system')]);
      const sortedSpeakers = [...allSpeakers].sort((a, b) => (speakerFrequencies[b] || (characterSettings[b]?.isNew ? -1 : 0)) - (speakerFrequencies[a] || (characterSettings[a]?.isNew ? -1 : 0)) || a.localeCompare(b) );

      if (sortedSpeakers.length === 0) { characterSettingsDiv.innerHTML = '<p class="text-gray-500 italic">ログ内に認識可能な発言者がいませんでした。新規キャラクターを追加できます。</p>'; return; }

      const fragment = document.createDocumentFragment();
      sortedSpeakers.forEach(speaker => {
          if (!characterSettings[speaker]) {
             characterSettings[speaker] = { displayName: speaker, icon: null, expressions: {}, alignment: 'left', color: '#000000', customTextColor: null, forceNarration: false, isNew: !speakerFrequencies[speaker] };
          }
          const setting = characterSettings[speaker];
          if (!setting.color) setting.color = '#000000';
          if (typeof setting.customTextColor === 'undefined') setting.customTextColor = null;
          if (typeof setting.forceNarration === 'undefined') setting.forceNarration = false;


          const count = speakerFrequencies[speaker] || 0;
          const uniqueSpeakerIdSuffix = generateSafeIdSuffix(speaker);

          const container = document.createElement('div'); container.className = 'p-3 border rounded-md bg-white shadow-sm';
          const mainInfoDiv = document.createElement('div'); mainInfoDiv.className = 'flex items-center space-x-4 mb-2';

          const iconDiv = document.createElement('div'); iconDiv.className = 'flex-shrink-0';
          const imgPreview = document.createElement('img'); imgPreview.id = `icon-preview-${uniqueSpeakerIdSuffix}`;
          imgPreview.src = setting.icon || PLACEHOLDER_ICON_URL.replace('64x64', '40x40');
          imgPreview.alt = `${setting.displayName} のデフォルトアイコン`; imgPreview.className = 'w-10 h-10 rounded-full object-cover border border-gray-300 character-icon-preview';
          imgPreview.loading = 'lazy';
          imgPreview.onerror = () => { if (imgPreview.src !== PLACEHOLDER_ICON_URL.replace('64x64', '40x40')) imgPreview.src = PLACEHOLDER_ICON_URL.replace('64x64', '40x40'); if (characterSettings[speaker]) characterSettings[speaker].icon = null; };
          const iconInput = document.createElement('input'); iconInput.type = 'file'; iconInput.accept = 'image/*'; iconInput.id = `icon-input-${uniqueSpeakerIdSuffix}`; iconInput.className = 'visually-hidden'; iconInput.setAttribute('aria-labelledby', `icon-label-${uniqueSpeakerIdSuffix}`);
          iconInput.addEventListener('change', (e) => handleDefaultIconUpload(e, speaker));
          const iconLabel = document.createElement('label'); iconLabel.htmlFor = `icon-input-${uniqueSpeakerIdSuffix}`; iconLabel.id = `icon-label-${uniqueSpeakerIdSuffix}`; iconLabel.className = 'cursor-pointer'; iconLabel.setAttribute('title', `クリックして ${setting.displayName} のデフォルトアイコンを変更`); iconLabel.appendChild(imgPreview); iconDiv.appendChild(iconLabel); iconDiv.appendChild(iconInput);

          const nameAndControlsDiv = document.createElement('div'); nameAndControlsDiv.className = 'flex-grow min-w-0';
          const nameLabel = document.createElement('label'); nameLabel.htmlFor = `name-input-${uniqueSpeakerIdSuffix}`; nameLabel.className = 'block text-sm font-medium text-gray-700 mb-1'; nameLabel.innerHTML = `「${escapeHtml(speaker)}」 <span class="text-xs text-gray-500">(${count}回)</span> 表示名:`;
          const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.id = `name-input-${uniqueSpeakerIdSuffix}`; nameInput.value = setting.displayName; nameInput.className = 'block w-full rounded-md border-gray-300 shadow-sm p-1.5 focus:border-indigo-500 focus:ring-indigo-500 text-sm mb-2'; nameInput.setAttribute('aria-label', `${escapeHtml(speaker)} の表示名`);
          nameInput.addEventListener('input', (e) => { const newDisplayName = e.target.value; if (characterSettings[speaker]) { characterSettings[speaker].displayName = newDisplayName; updateSpeakerFilterOptionText(speaker, newDisplayName); updateSpeakerDataForExport(); renderLog(); } });

          const controlsGrid = document.createElement('div');
          controlsGrid.className = 'grid grid-cols-2 gap-x-4 gap-y-2';

          const charColorDiv = document.createElement('div'); charColorDiv.className = 'flex items-center space-x-2';
          const charColorLabel = document.createElement('span'); charColorLabel.className = 'text-sm font-medium text-gray-700'; charColorLabel.textContent = 'テーマ色:';
          const charColorInput = document.createElement('input'); charColorInput.type = 'color'; charColorInput.id = `char-color-input-${uniqueSpeakerIdSuffix}`;
          charColorInput.value = setting.color || '#000000';
          charColorInput.className = 'p-0.5 h-7 w-10 border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500';
          charColorInput.setAttribute('aria-label', `${escapeHtml(speaker)} のキャラクターテーマカラー (アイコン枠線等)`);
          charColorInput.addEventListener('input', (e) => {
              if(characterSettings[speaker]) { characterSettings[speaker].color = e.target.value; updateSpeakerDataForExport(); renderLog(); }
          });
          charColorDiv.appendChild(charColorLabel); charColorDiv.appendChild(charColorInput);

          const charTextColorDiv = document.createElement('div'); charTextColorDiv.className = 'flex items-center space-x-2';
          const charTextColorLabel = document.createElement('span'); charTextColorLabel.className = 'text-sm font-medium text-gray-700'; charTextColorLabel.textContent = '文字色:';
          const charTextColorInput = document.createElement('input'); charTextColorInput.type = 'color'; charTextColorInput.id = `char-text-color-input-${uniqueSpeakerIdSuffix}`;
          charTextColorInput.value = setting.customTextColor || customizationSettings.baseTextColor;
          charTextColorInput.className = 'p-0.5 h-7 w-10 border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500';
          charTextColorInput.setAttribute('aria-label', `${escapeHtml(speaker)} の文字色`);
          charTextColorInput.addEventListener('input', (e) => {
              if(characterSettings[speaker]) {
                  characterSettings[speaker].customTextColor = e.target.value;
                  updateSpeakerDataForExport();
                  renderLog();
              }
          });
          const resetTextColorButton = document.createElement('button');
          resetTextColorButton.textContent = 'リセット';
          resetTextColorButton.className = 'text-xs px-1 py-0.5 border rounded hover:bg-gray-100';
          resetTextColorButton.title = '基本文字色に戻す';
          resetTextColorButton.onclick = () => {
              if(characterSettings[speaker]) {
                  characterSettings[speaker].customTextColor = null;
                  charTextColorInput.value = customizationSettings.baseTextColor;
                  updateSpeakerDataForExport();
                  renderLog();
              }
          };
          charTextColorDiv.appendChild(charTextColorLabel);
          charTextColorDiv.appendChild(charTextColorInput);
          charTextColorDiv.appendChild(resetTextColorButton);

          const forceNarrationDiv = document.createElement('div');
          forceNarrationDiv.className = 'flex items-center space-x-2';
          const forceNarrationLabel = document.createElement('label');
          forceNarrationLabel.htmlFor = `force-narration-toggle-${uniqueSpeakerIdSuffix}`;
          forceNarrationLabel.className = 'text-sm font-medium text-gray-700';
          forceNarrationLabel.textContent = '常に地の文:';
          const switchLabel = document.createElement('label');
          switchLabel.className = 'switch';
          const forceNarrationInput = document.createElement('input');
          forceNarrationInput.type = 'checkbox';
          forceNarrationInput.id = `force-narration-toggle-${uniqueSpeakerIdSuffix}`;
          forceNarrationInput.checked = setting.forceNarration;
          forceNarrationInput.addEventListener('change', (e) => {
              if (characterSettings[speaker]) {
                  characterSettings[speaker].forceNarration = e.target.checked;
                  updateSpeakerDataForExport();
                  renderLog();
              }
          });
          const sliderSpan = document.createElement('span');
          sliderSpan.className = 'slider';
          switchLabel.appendChild(forceNarrationInput);
          switchLabel.appendChild(sliderSpan);
          forceNarrationDiv.appendChild(forceNarrationLabel);
          forceNarrationDiv.appendChild(switchLabel);


          // 表示方向（発言者ごとモード時のみ表示）
          const charAlignDiv = document.createElement('div');
          charAlignDiv.className = 'flex items-center space-x-2';
          if (!customizationSettings.speakerAlignmentMode) charAlignDiv.classList.add('hidden');
          const charAlignLabel = document.createElement('span');
          charAlignLabel.className = 'text-sm font-medium text-gray-700';
          charAlignLabel.textContent = '表示方向:';
          const charAlignSelect = document.createElement('select');
          charAlignSelect.className = 'text-sm p-1 border border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500';
          getAlignmentOptions().forEach(([val, text]) => {
              const opt = document.createElement('option');
              opt.value = val; opt.textContent = text;
              if ((setting.alignment || 'left') === val) opt.selected = true;
              charAlignSelect.appendChild(opt);
          });
          charAlignSelect.addEventListener('change', (e) => {
              if (characterSettings[speaker]) {
                  characterSettings[speaker].alignment = e.target.value;
                  renderLog();
              }
          });
          charAlignDiv.appendChild(charAlignLabel);
          charAlignDiv.appendChild(charAlignSelect);

          const mergeBtn = document.createElement('button');
          mergeBtn.textContent = '別キャラに統合…';
          mergeBtn.className = 'text-xs px-2 py-1 border border-orange-400 text-orange-600 rounded hover:bg-orange-50 self-center';
          mergeBtn.style.cssText = 'width: fit-content; justify-self: start;';
          mergeBtn.title = 'この発言者の発言をすべて別のキャラクターに統合し、このキャラクター設定を削除します';
          mergeBtn.addEventListener('click', () => openMergeCharacterModal(speaker));

          controlsGrid.appendChild(charColorDiv);
          controlsGrid.appendChild(charTextColorDiv);
          controlsGrid.appendChild(forceNarrationDiv);
          controlsGrid.appendChild(charAlignDiv);
          controlsGrid.appendChild(mergeBtn);

          nameAndControlsDiv.appendChild(nameLabel); nameAndControlsDiv.appendChild(nameInput); nameAndControlsDiv.appendChild(controlsGrid);

          mainInfoDiv.appendChild(iconDiv); mainInfoDiv.appendChild(nameAndControlsDiv);
          container.appendChild(mainInfoDiv);

          const expressionSection = document.createElement('div'); expressionSection.className = 'expression-section'; expressionSection.id = `expressions-${uniqueSpeakerIdSuffix}`;
          const expressionTitle = document.createElement('h4'); expressionTitle.textContent = '表情差分アイコン:'; expressionTitle.className = 'text-sm font-medium text-gray-600 mb-2'; expressionSection.appendChild(expressionTitle);
          const expressionList = document.createElement('div'); expressionList.className = 'space-y-1 mb-3'; expressionSection.appendChild(expressionList);
          populateExpressionList(expressionList, speaker);

          const addForm = document.createElement('div'); addForm.className = 'add-expression-form';
          const expressionNameInput = document.createElement('input'); expressionNameInput.type = 'text'; expressionNameInput.placeholder = '差分名 (例: 笑顔)'; expressionNameInput.className = 'add-expression-name-input'; expressionNameInput.id = `exp-name-input-${uniqueSpeakerIdSuffix}`;
          const expressionFileLabel = document.createElement('label'); const hiddenInputId = `exp-file-input-${uniqueSpeakerIdSuffix}`; expressionFileLabel.htmlFor = hiddenInputId; expressionFileLabel.textContent = '画像選択';
          const expressionFileInput = document.createElement('input'); expressionFileInput.type = 'file'; expressionFileInput.accept = 'image/*'; expressionFileInput.className = 'visually-hidden'; expressionFileInput.id = hiddenInputId;
          expressionFileInput.addEventListener('change', (e) => { expressionAddContext = { speaker: speaker, inputElement: e.target }; handleAddExpressionFile(); });
          addForm.appendChild(expressionNameInput); addForm.appendChild(expressionFileLabel); addForm.appendChild(expressionFileInput);
          expressionSection.appendChild(addForm);
          container.appendChild(expressionSection);

          fragment.appendChild(container);
      });
      characterSettingsDiv.appendChild(fragment);
  }

  function generateSafeIdSuffix(name) {
      if (!name) return '';
      // IDとして安全な文字列を生成するため、英数字とハイフン、アンダースコア以外を文字コード(U+XXXX)に置換
      return String(name).replace(/[^a-zA-Z0-9_-]/g, c => `U${c.charCodeAt(0)}`);
  }

  function populateExpressionList(listElement, speaker) {
       listElement.innerHTML = ''; const expressions = characterSettings[speaker]?.expressions || {}; const sortedNames = Object.keys(expressions).sort();
       if (sortedNames.length === 0) { listElement.innerHTML = '<p class="text-xs text-gray-500 italic">差分アイコン未登録</p>'; return; }
       sortedNames.forEach(expName => {
           const expDataUrl = expressions[expName]; const itemDiv = document.createElement('div'); itemDiv.className = 'expression-item';
           const img = document.createElement('img'); img.src = expDataUrl || PLACEHOLDER_ICON_URL.replace('64x64', '32x32'); img.alt = expName; img.className = 'expression-preview'; img.loading = 'lazy'; img.onerror = () => { img.src = PLACEHOLDER_ICON_URL.replace('64x64', '32x32'); };
           const nameSpan = document.createElement('span'); nameSpan.className = 'expression-name'; nameSpan.textContent = escapeHtml(expName);
           const deleteBtn = document.createElement('button'); deleteBtn.textContent = '削除'; deleteBtn.className = 'expression-delete-btn'; deleteBtn.onclick = () => handleDeleteExpression(speaker, expName);
           itemDiv.appendChild(img); itemDiv.appendChild(nameSpan); itemDiv.appendChild(deleteBtn); listElement.appendChild(itemDiv);
       });
  }

  function updateSpeakerFilterOptionText(originalSpeaker, newDisplayName) { try { const escapedSpeaker = escapeCssSelector(originalSpeaker); const option = speakerFilterSelect.querySelector(`option[value="${escapedSpeaker}"]`); if (option) { const count = speakerFrequencies[originalSpeaker] || 0; const displayName = newDisplayName?.trim() || originalSpeaker; option.textContent = `${escapeHtml(displayName)} (${count}回)${characterSettings[originalSpeaker]?.isNew ? ' (新規)' : ''}`; } } catch (e) { console.error(`Error updating speaker filter option for "${originalSpeaker}":`, e); } }

  async function handleDefaultIconUpload(event, speaker) {
      const file = event.target.files?.[0]; if (!file) return;
      if (!file.type.startsWith('image/')) { alert('画像ファイルを選択してください。'); event.target.value = null; return; }
      if (file.size > MAX_FILE_SIZE_BYTES) { alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB以下にしてください。`); event.target.value = null; return; }
      const uniqueSpeakerIdSuffix = generateSafeIdSuffix(speaker); const imgPreview = document.getElementById(`icon-preview-${uniqueSpeakerIdSuffix}`);
      try {
          const dataUrl = await readFileAsDataURL(file); if (imgPreview) imgPreview.src = dataUrl;
          if (!characterSettings[speaker]) characterSettings[speaker] = { displayName: speaker, icon: null, expressions: {}, color: '#000000', customTextColor: null, forceNarration: false, isNew: true };
          characterSettings[speaker].icon = dataUrl;
          const uploadKey = characterSettings[speaker].isNew ? `newchar_${speaker}` : speaker;
          uploadedFiles[uploadKey] = new File([await file.arrayBuffer()], file.name, { type: file.type });
          renderLog();
      } catch (error) { console.error(`Error processing default icon for ${speaker}:`, error); alert(`アイコン読込エラー: ${error.message}`); if (imgPreview && characterSettings[speaker]?.icon) imgPreview.src = characterSettings[speaker].icon; else if (imgPreview) imgPreview.src = PLACEHOLDER_ICON_URL.replace('64x64', '40x40'); }
      finally { if (event.target) event.target.value = null; }
  }

  async function handleAddExpressionFile() {
       const { speaker, inputElement } = expressionAddContext; if (!speaker || !inputElement || !inputElement.files || inputElement.files.length === 0) { expressionAddContext = { speaker: null, inputElement: null }; return; }
       const file = inputElement.files[0]; const uniqueSpeakerIdSuffix = generateSafeIdSuffix(speaker); const nameInput = document.getElementById(`exp-name-input-${uniqueSpeakerIdSuffix}`); const expressionName = nameInput ? nameInput.value.trim() : '';
       const currentSpeaker = speaker; if (inputElement) inputElement.value = null; expressionAddContext = { speaker: null, inputElement: null };
       if (!expressionName) { alert('差分名を入力してください。'); return; } if (characterSettings[currentSpeaker]?.expressions?.[expressionName]) { alert(`差分名「${expressionName}」は既に使用されています。`); return; }
       if (!file.type.startsWith('image/')) { alert('画像ファイルを選択してください。'); return; } if (file.size > MAX_FILE_SIZE_BYTES) { alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB以下にしてください。`); return; }
       showLoading();
       try {
           const dataUrl = await readFileAsDataURL(file);
           if (!characterSettings[currentSpeaker]) characterSettings[currentSpeaker] = { displayName: currentSpeaker, icon: null, expressions: {}, alignment: 'left', color: '#000000', customTextColor: null, forceNarration: false, isNew: true };
           if (!characterSettings[currentSpeaker].expressions) characterSettings[currentSpeaker].expressions = {};
           characterSettings[currentSpeaker].expressions[expressionName] = dataUrl;

           if (!expressionAliasMap[currentSpeaker]) {
               expressionAliasMap[currentSpeaker] = {};
           }
           if (!expressionAliasMap[currentSpeaker][expressionName]) {
               expressionAliasMap[currentSpeaker][expressionName] = `emote_${nextExpressionAliasId++}`;
           }

           const uploadKey = `exp_${currentSpeaker}_${expressionName}`; uploadedFiles[uploadKey] = new File([await file.arrayBuffer()], file.name, { type: file.type });
           if (nameInput) nameInput.value = '';
           const expressionListDiv = document.getElementById(`expressions-${uniqueSpeakerIdSuffix}`)?.querySelector('.space-y-1');
           if (expressionListDiv) populateExpressionList(expressionListDiv, currentSpeaker);
       } catch (error) { console.error(`Error adding expression for ${currentSpeaker}:`, error); alert(`差分アイコン読込エラー: ${error.message}`); }
       finally { hideLoading(); }
  }

  function handleDeleteExpression(speaker, expressionName) {
       if (!characterSettings[speaker]?.expressions?.[expressionName]) return;
       if (!(customizationSettings.skipDeleteConfirm || confirm(`「${speaker}」の差分「${expressionName}」を削除しますか？`))) return;
       delete characterSettings[speaker].expressions[expressionName];
       if (expressionAliasMap[speaker] && expressionAliasMap[speaker][expressionName]) {
           delete expressionAliasMap[speaker][expressionName];
       }
       const uploadKey = `exp_${speaker}_${expressionName}`; if (uploadedFiles[uploadKey]) delete uploadedFiles[uploadKey];
       const uniqueSpeakerIdSuffix = generateSafeIdSuffix(speaker); const expressionListDiv = document.getElementById(`expressions-${uniqueSpeakerIdSuffix}`)?.querySelector('.space-y-1');
       if (expressionListDiv) populateExpressionList(expressionListDiv, speaker);

       displayLogData.forEach(item => {
           if (item.type === 'message' && item.speaker === speaker && item.iconKey === expressionName) {
               item.iconKey = 'default';
               const messageElement = logDisplayDiv.querySelector(`.message-item[data-item-id="${item.id}"]`);
               if (messageElement) {
                   updateMessageIconElement(messageElement, item);
               }
           }
       });
  }

  function openMergeCharacterModal(sourceSpeaker) {
      const otherSpeakers = Object.keys(characterSettings).filter(s => s !== sourceSpeaker && s !== 'system');
      if (otherSpeakers.length === 0) {
          alert('統合先となる他のキャラクターが存在しません。');
          return;
      }
      genericModalTitle.textContent = '別キャラクターに統合';
      const sourceDisplayName = characterSettings[sourceSpeaker]?.displayName || sourceSpeaker;
      const optionsHtml = otherSpeakers
          .map(s => `<option value="${escapeHtml(s)}">${escapeHtml(characterSettings[s]?.displayName || s)}</option>`)
          .join('');
      genericModalBody.innerHTML = `
          <p class="text-sm text-gray-700 mb-3">
              「<strong>${escapeHtml(sourceDisplayName)}</strong>」の発言をすべて以下のキャラクターに統合します。<br>
              テーマ色・文字色・アイコン等は統合先の設定に置き換わります。<br>
              この操作は取り消せません。
          </p>
          <div class="modal-form-group">
              <label for="merge-target-select">統合先キャラクター:</label>
              <select id="merge-target-select" class="block w-full rounded-md border-gray-300 shadow-sm p-1.5 text-sm">
                  ${optionsHtml}
              </select>
          </div>
      `;
      genericModalConfirmBtn.textContent = '統合する';
      genericModalConfirmBtn.className = 'btn-danger';
      genericModalConfirmBtn.onclick = () => {
          const targetSpeaker = document.getElementById('merge-target-select').value;
          const targetDisplayName = characterSettings[targetSpeaker]?.displayName || targetSpeaker;
          handleMergeCharacterConfirm(sourceSpeaker, targetSpeaker);
      };
      openModal(genericModal);
  }

  function handleMergeCharacterConfirm(sourceSpeaker, targetSpeaker) {
      if (!characterSettings[targetSpeaker]) return;

      // displayLogData の speaker を書き換え
      displayLogData.forEach(item => {
          if (item.type === 'message' && item.speaker === sourceSpeaker) {
              item.speaker = targetSpeaker;
              // 個別アイコン上書きはそのまま保持（統合先のデフォルトアイコンに任せる）
              if (item.iconKey !== 'default') {
                  // 統合先に同名の差分がなければ default に戻す
                  if (!characterSettings[targetSpeaker].expressions?.[item.iconKey]) {
                      item.iconKey = 'default';
                  }
              }
              item.overrideIconSrc = null;
          }
      });

      // speakerFrequencies をマージ
      if (speakerFrequencies[sourceSpeaker]) {
          speakerFrequencies[targetSpeaker] = (speakerFrequencies[targetSpeaker] || 0) + speakerFrequencies[sourceSpeaker];
          delete speakerFrequencies[sourceSpeaker];
      }

      // アップロード済みファイルのクリーンアップ
      const sourceKey = `newchar_${sourceSpeaker}`;
      if (uploadedFiles[sourceKey]) delete uploadedFiles[sourceKey];
      if (uploadedFiles[sourceSpeaker]) delete uploadedFiles[sourceSpeaker];
      const sourceExpressions = characterSettings[sourceSpeaker]?.expressions || {};
      Object.keys(sourceExpressions).forEach(expName => {
          const uploadKey = `exp_${sourceSpeaker}_${expName}`;
          if (uploadedFiles[uploadKey]) delete uploadedFiles[uploadKey];
      });

      // speakerFilenameAlias もクリーンアップ
      if (speakerFilenameAlias[sourceSpeaker]) delete speakerFilenameAlias[sourceSpeaker];

      // expressionAliasMap もクリーンアップ
      if (expressionAliasMap[sourceSpeaker]) delete expressionAliasMap[sourceSpeaker];

      // characterSettings から source を削除
      delete characterSettings[sourceSpeaker];

      closeModal(genericModal);
      updateSpeakerDataForExport();
      populateCharacterSettingsUI();
      populateSpeakerFilterUI();
      renderLog();

      const targetDisplayName = characterSettings[targetSpeaker]?.displayName || targetSpeaker;
  }

  function openAddNewCharacterModal() {
      genericModalTitle.textContent = '新規キャラクター追加';
      genericModalBody.innerHTML = `
          <div class="modal-form-group">
              <label for="new-char-name">内部名 (必須, 半角英数と_のみ):</label>
              <input type="text" id="new-char-name" placeholder="e.g. player1_Alice">
          </div>
          <div class="modal-form-group">
              <label for="new-char-display-name">表示名 (必須):</label>
              <input type="text" id="new-char-display-name" placeholder="例: アリス">
          </div>
          <div class="modal-form-group">
              <label for="new-char-icon-label">アイコン (任意):</label>
              <img id="new-char-icon-preview" src="${PLACEHOLDER_ICON_URL.replace('64x64', '40x40')}" alt="Icon Preview" class="w-10 h-10 rounded-full object-cover border border-gray-300 mb-1 character-icon-preview">
              <input type="file" id="new-char-icon-modal-input-actual" accept="image/*" class="visually-hidden">
              <label for="new-char-icon-modal-input-actual" class="file-input-label text-sm py-1 px-2">画像選択...</label>
              <span id="new-char-icon-filename" class="text-xs ml-2"></span>
          </div>
          <div class="modal-form-group">
              <label for="new-char-theme-color">キャラクターテーマカラー:</label>
              <input type="color" id="new-char-theme-color" value="#000000">
          </div>
          <div class="modal-form-group">
              <label for="new-char-text-color">文字色 (任意、未指定時は基本文字色):</label>
              <input type="color" id="new-char-text-color" value="${customizationSettings.baseTextColor}">
              <button type="button" id="reset-new-char-text-color" class="text-xs ml-2 p-1 border rounded hover:bg-gray-100">基本色に戻す</button>
          </div>
          <div class="modal-form-group flex items-center space-x-2">
              <label for="new-char-force-narration" class="text-sm font-medium text-gray-700">常に地の文で表示:</label>
              <label class="switch"><input type="checkbox" id="new-char-force-narration"><span class="slider"></span></label>
          </div>
      `;
      document.getElementById('new-char-icon-modal-input-actual').onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
              document.getElementById('new-char-icon-filename').textContent = file.name;
              readFileAsDataURL(file).then(dataUrl => {
                  document.getElementById('new-char-icon-preview').src = dataUrl;
              }).catch(err => console.error("Preview error:", err));
          } else {
              document.getElementById('new-char-icon-filename').textContent = '';
              document.getElementById('new-char-icon-preview').src = PLACEHOLDER_ICON_URL.replace('64x64', '40x40');
          }
      };
      document.getElementById('reset-new-char-text-color').onclick = () => {
          document.getElementById('new-char-text-color').value = customizationSettings.baseTextColor;
      };
      genericModalConfirmBtn.onclick = handleAddNewCharacterConfirm;
      openModal(genericModal);
  }

  async function handleAddNewCharacterConfirm() {
      const internalName = document.getElementById('new-char-name').value.trim();
      const displayName = document.getElementById('new-char-display-name').value.trim();
      const themeColor = document.getElementById('new-char-theme-color').value;
      const textColorInput = document.getElementById('new-char-text-color');
      const forceNarration = document.getElementById('new-char-force-narration').checked;
      let customTextColor = textColorInput.value;
      if (customTextColor === customizationSettings.baseTextColor) {
          customTextColor = null;
      }
      const iconFile = document.getElementById('new-char-icon-modal-input-actual').files[0];

      if (!internalName || !displayName) { alert('内部名と表示名は必須です。'); return; }
      if (!/^[a-zA-Z0-9_]+$/.test(internalName)) { alert('内部名は半角英数字とアンダースコアのみ使用できます。'); return; }
      if (characterSettings[internalName] || speakerFrequencies[internalName]) { alert(`内部名「${internalName}」は既に使用されています。`); return; }

      let iconDataUrl = null;
      if (iconFile) {
          if (!iconFile.type.startsWith('image/')) { alert('画像ファイルを選択してください。'); return; }
          if (iconFile.size > MAX_FILE_SIZE_BYTES) { alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB以下にしてください。`); return; }
          try { iconDataUrl = await readFileAsDataURL(iconFile); }
          catch (e) { alert('アイコン画像の読み込みに失敗しました。'); return; }
      }

      characterSettings[internalName] = {
          displayName: displayName,
          icon: iconDataUrl,
          expressions: {},
          color: themeColor,
          customTextColor: customTextColor,
          forceNarration: forceNarration,
          isNew: true
      };
      if (iconFile) uploadedFiles[`newchar_${internalName}`] = iconFile;

      if (!speakerFilenameAlias[internalName]) {
          speakerFilenameAlias[internalName] = internalName;
      }

      updateSpeakerDataForExport();
      populateCharacterSettingsUI();
      populateSpeakerFilterUI();
      closeModal(genericModal);
      alert(`キャラクター「${displayName}」が追加されました。`);
  }

  function openAddChatItemModal(targetMessageId) {
      actionTargetItemId = targetMessageId;
      genericModalTitle.textContent = '発言を追加';
      const speakerOptions = Object.entries(characterSettings)
          .filter(([id, char]) => id !== 'system')
          .map(([id, char]) => `<option value="${escapeHtml(id)}">${escapeHtml(char.displayName)}</option>`)
          .join('');

      const targetItem = displayLogData.find(item => item.id === targetMessageId);
      const defaultTab = targetItem ? (targetItem.tab || 'main') : 'main';

      let availableTabsForSelect = [...uniqueTabsFound].filter(t => t !== 'all');
      if (availableTabsForSelect.length === 0) {
          availableTabsForSelect = ['main'];
          if (!uniqueTabsFound.has('main')) uniqueTabsFound.add('main');
      }

      const tabOptions = availableTabsForSelect
          .map(tab => `<option value="${escapeHtml(tab)}" ${tab === defaultTab ? 'selected' : ''}>${escapeHtml(tab)}</option>`)
          .join('');

      genericModalBody.innerHTML = `
          <p class="text-sm text-gray-600 mb-2">ID: ${targetMessageId} のメッセージの下に新しい発言を挿入します。</p>
          <div class="modal-form-group">
              <label for="add-chat-speaker">発言者:</label>
              <select id="add-chat-speaker">${speakerOptions}</select>
          </div>
          <div class="modal-form-group">
              <label for="add-chat-tab">タブ:</label>
              <select id="add-chat-tab">${tabOptions}</select>
          </div>
          <div class="modal-form-group">
              <label for="add-chat-message">メッセージ:</label>
              <textarea id="add-chat-message" rows="3" placeholder="発言内容..."></textarea>
          </div>
      `;
      genericModalConfirmBtn.onclick = handleAddChatItemConfirm;
      openModal(genericModal);
  }

  function handleAddChatItemConfirm() {
      const speakerId = document.getElementById('add-chat-speaker').value;
      const messageText = document.getElementById('add-chat-message').value;
      const selectedTab = document.getElementById('add-chat-tab').value;
      const referenceItemId = actionTargetItemId;

      if (!speakerId || !messageText.trim() || !selectedTab) { alert('発言者、メッセージ内容、タブは必須です。'); return; }

      const refItemIndex = displayLogData.findIndex(item => item.id === referenceItemId);
      if (refItemIndex === -1) { alert('参照メッセージが見つかりません。'); closeModal(genericModal); return; }

      const refItem = displayLogData[refItemIndex];
      const newChatItem = {
          type: 'message',
          id: generateUniqueId('newmsg'),
          tab: selectedTab,
          speaker: speakerId,
          color: characterSettings[speakerId]?.color || '#000000',
          message: messageText,
          displayMode: 'bubble',
          iconKey: 'default',
          overrideIconSrc: null,
          isNew: true
      };

      // 参照メッセージに紐付く画像の末尾に挿入
      let chatInsertAtIndex = refItemIndex + 1;
      while (chatInsertAtIndex < displayLogData.length &&
             displayLogData[chatInsertAtIndex].type === 'image' &&
             displayLogData[chatInsertAtIndex].anchorId === referenceItemId) {
          chatInsertAtIndex++;
      }
      displayLogData.splice(chatInsertAtIndex, 0, newChatItem);

      const newElement = createMessageElement(newChatItem);
      if (newElement) {
          const referenceElement = logDisplayDiv.querySelector(`[data-item-id="${referenceItemId}"]`);
          if (referenceElement && referenceElement.parentElement === logDisplayDiv) {
              let actualInsertAfter = referenceElement;
              let nextSibling = referenceElement.nextElementSibling;
              while(nextSibling && nextSibling.classList.contains('image-item')) {
                  const imgItemData = displayLogData.find(d => d.id === nextSibling.dataset.itemId);
                  if(imgItemData && imgItemData.anchorId === referenceItemId) {
                      actualInsertAfter = nextSibling;
                      nextSibling = nextSibling.nextElementSibling;
                  } else {
                      break;
                  }
              }
              if (actualInsertAfter.nextElementSibling) {
                  logDisplayDiv.insertBefore(newElement, actualInsertAfter.nextElementSibling);
              } else {
                  logDisplayDiv.appendChild(newElement);
              }
          } else {
              renderLog();
          }
      }
      recomputeFilterState();
      closeModal(genericModal);
  }

  function openAddHeadingModal(targetMessageId) {
      actionTargetItemId = targetMessageId;
      genericModalTitle.textContent = '見出しを追加';
      genericModalBody.innerHTML = `
          <p class="text-sm text-gray-600 mb-2">ID: ${targetMessageId || '先頭'} の直前に見出しを挿入します。</p>
          <div class="modal-form-group">
              <label for="add-heading-text">見出し文:</label>
              <input type="text" id="add-heading-text" placeholder="例: 新しい場面">
          </div>
          <div class="modal-form-group">
              <label for="add-heading-level">レベル:</label>
              <select id="add-heading-level">
                  <option value="1">レベル1 (大見出し)</option>
                  <option value="2" selected>レベル2 (中見出し)</option>
                  <option value="3">レベル3 (小見出し)</option>
                  <option value="4">レベル4</option>
                  <option value="5">レベル5</option>
                  <option value="6">レベル6</option>
              </select>
          </div>
      `;
      genericModalConfirmBtn.onclick = handleAddHeadingConfirm;
      openModal(genericModal);
  }

  function handleAddHeadingConfirm() {
      const text = document.getElementById('add-heading-text').value.trim();
      const level = parseInt(document.getElementById('add-heading-level').value, 10);
      const referenceItemId = actionTargetItemId;
      if (!text) { alert('見出し文は必須です。'); return; }

      let refItemIndex = -1;
      let refItem = null;

      if (referenceItemId) {
          refItemIndex = displayLogData.findIndex(item => item.id === referenceItemId);
          if (refItemIndex === -1) { alert('参照メッセージが見つかりません。'); closeModal(genericModal); return; }
          refItem = displayLogData[refItemIndex];
      }

      const newHeadingItem = {
          type: 'heading',
          id: generateUniqueId('head'),
          level: level,
          text: text,
          isNew: true
      };

      // referenceItemId がある場合はその直前、ない場合は先頭
      const insertAtIndex = refItemIndex !== -1 ? refItemIndex : 0;
      displayLogData.splice(insertAtIndex, 0, newHeadingItem);

      const newElement = createHeadingElement(newHeadingItem);
      if (newElement) {
          const referenceElement = referenceItemId ? logDisplayDiv.querySelector(`[data-item-id="${referenceItemId}"]`) : (logDisplayDiv.firstChild || null);
          if (referenceElement) {
              logDisplayDiv.insertBefore(newElement, referenceElement);
          } else {
              logDisplayDiv.appendChild(newElement);
          }
      }
      updateHeadingsNav();
      closeModal(genericModal);
  }

  function openModal(modalElement) { modalElement.classList.remove('hidden'); }
  function closeModal(modalElement) { modalElement.classList.add('hidden'); genericModalBody.innerHTML = ''; genericModalConfirmBtn.textContent = 'OK'; genericModalConfirmBtn.className = 'btn-primary'; }

  function populateTabsUI() {
      logTabsNav.innerHTML = '';
      const sortedTabs = ['all', ...[...uniqueTabsFound].filter(t=> t !== 'all').sort((a, b) => a.localeCompare(b))];
      if (sortedTabs.length <= 1 && sortedTabs[0] === 'all') { logTabsNav.innerHTML = '<span class="whitespace-nowrap py-2 px-1 text-gray-500 text-sm italic">タブ情報なし</span>'; return; }
      const fragment = document.createDocumentFragment();
      sortedTabs.forEach(tab => {
          const isTabHidden = tab !== 'all' && !!tabSettings[tab]?.hidden;
          const button = document.createElement('button');
          button.textContent = isTabHidden ? `[${escapeHtml(tab)}] 🚫` : `[${escapeHtml(tab)}]`;
          button.dataset.tab = tab;
          const baseClasses = 'whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors duration-150 ease-in-out';
          const activeClasses = 'border-indigo-500 text-indigo-600'; const inactiveClasses = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
          const hiddenClasses = 'opacity-40 line-through';
          const isActive = tab === currentTabFilter;
          button.className = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}${isTabHidden ? ' ' + hiddenClasses : ''}`;
          button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', isActive ? 'true' : 'false');
          fragment.appendChild(button);
      });
      logTabsNav.appendChild(fragment); logTabsNav.setAttribute('role', 'tablist');

      handleTabChange(currentTabFilter); // To ensure 'all' mode filter UI is shown if needed
  }

  function populateAllModeTabFilterUI() {
    allModeTabFilterDiv.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'flex flex-wrap items-center gap-x-4 gap-y-2 w-full';

    const title = document.createElement('span');
    title.className = 'text-sm font-medium text-gray-700';
    title.textContent = '表示タブ:';
    container.appendChild(title);

    const checkboxGroup = document.createElement('div');
    checkboxGroup.className = 'flex flex-wrap gap-x-3 gap-y-1';

    const tabsToDisplay = [...uniqueTabsFound].filter(t => t !== 'all').sort((a, b) => a.localeCompare(b));

    tabsToDisplay.forEach(tab => {
        const checkboxId = `tab-checkbox-${generateSafeIdSuffix(tab)}`;
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.value = tab;
        checkbox.checked = visibleTabsInAllMode.has(tab);
        checkbox.className = 'h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500';
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                visibleTabsInAllMode.add(tab);
            } else {
                visibleTabsInAllMode.delete(tab);
            }
            renderLog();
        });

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.textContent = escapeHtml(tab);
        label.className = 'ml-2 block text-sm text-gray-900 cursor-pointer';

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        checkboxGroup.appendChild(wrapper);
    });
    container.appendChild(checkboxGroup);

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ml-auto flex gap-2';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = '全選択';
    selectAllBtn.className = 'text-xs px-2 py-1 border rounded hover:bg-gray-200';
    selectAllBtn.onclick = () => {
        tabsToDisplay.forEach(tab => visibleTabsInAllMode.add(tab));
        populateAllModeTabFilterUI();
        renderLog();
    };

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = '全解除';
    deselectAllBtn.className = 'text-xs px-2 py-1 border rounded hover:bg-gray-200';
    deselectAllBtn.onclick = () => {
        visibleTabsInAllMode.clear();
        populateAllModeTabFilterUI();
        renderLog();
    };

    buttonGroup.appendChild(selectAllBtn);
    buttonGroup.appendChild(deselectAllBtn);
    container.appendChild(buttonGroup);

    allModeTabFilterDiv.appendChild(container);
    allModeTabFilterDiv.classList.remove('hidden');
  }

  function populateTabSettingsUI() {
      const tabSettingsDiv = document.getElementById('tab-settings-ui');
      if (!tabSettingsDiv) return;
      tabSettingsDiv.innerHTML = '';

      const tabs = [...uniqueTabsFound].filter(t => t !== 'all').sort((a, b) => a.localeCompare(b));
      if (tabs.length === 0) {
          tabSettingsDiv.innerHTML = '<p class="text-gray-500 italic text-sm">タブ情報がありません。</p>';
          return;
      }

      const fragment = document.createDocumentFragment();
      tabs.forEach(tab => {
          if (!tabSettings[tab]) tabSettings[tab] = { alignment: 'left' };

          const row = document.createElement('div');
          row.className = 'flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b border-gray-200 last:border-0';

          const nameSpan = document.createElement('span');
          nameSpan.className = 'text-sm font-medium text-gray-700 flex-shrink-0 w-28 truncate';
          nameSpan.textContent = tab;
          nameSpan.title = tab;

          const isSpeakerMode = !!customizationSettings.speakerAlignmentMode;

          const label = document.createElement('span');
          label.className = 'text-sm text-gray-600 flex-shrink-0';
          label.textContent = '表示方向:';
          if (isSpeakerMode) label.classList.add('hidden');

          const alignSelect = document.createElement('select');
          alignSelect.className = 'text-sm p-1 border border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500';
          if (isSpeakerMode) alignSelect.classList.add('hidden');
          getAlignmentOptions().forEach(([val, text]) => {
              const option = document.createElement('option');
              option.value = val;
              option.textContent = text;
              if ((tabSettings[tab].alignment || 'left') === val) option.selected = true;
              alignSelect.appendChild(option);
          });
          alignSelect.addEventListener('change', (e) => {
              if (!tabSettings[tab]) tabSettings[tab] = {};
              tabSettings[tab].alignment = e.target.value;
              renderLog();
          });

          // 出力非表示トグル
          const tabHiddenToggle = document.createElement('button');
          const isTabHidden = !!tabSettings[tab].hidden;
          tabHiddenToggle.className = `tab-hidden-toggle ml-auto flex-shrink-0${isTabHidden ? ' active' : ''}`;
          tabHiddenToggle.textContent = isTabHidden ? '非表示中' : '非表示';
          tabHiddenToggle.title = isTabHidden ? 'クリックで表示に戻す' : 'このタブをエディタ・出力から非表示にする';
          tabHiddenToggle.addEventListener('click', () => {
              if (!tabSettings[tab]) tabSettings[tab] = {};
              tabSettings[tab].hidden = !tabSettings[tab].hidden;
              const nowHidden = !!tabSettings[tab].hidden;
              tabHiddenToggle.classList.toggle('active', nowHidden);
              tabHiddenToggle.textContent = nowHidden ? '非表示中' : '非表示';
              tabHiddenToggle.title = nowHidden ? 'クリックで表示に戻す' : 'このタブをエディタ・出力から非表示にする';
              populateTabsUI();
              renderLog();
          });

          // 削除ボタン
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'expression-delete-btn flex-shrink-0';
          deleteBtn.textContent = '削除';
          deleteBtn.title = `タブ「${tab}」とそのメッセージをすべて削除`;
          deleteBtn.addEventListener('click', () => {
              if (!confirm(`タブ「${tab}」に属するメッセージをすべて削除します。\nこの操作は取り消せません。よろしいですか？`)) return;
              deleteTab(tab);
          });

          // 統合ボタン（モーダルを開く）
          const mergeBtn = document.createElement('button');
          mergeBtn.className = 'text-xs px-2 py-1 border border-orange-400 text-orange-600 rounded hover:bg-orange-50 flex-shrink-0';
          mergeBtn.textContent = '他のタブに統合…';
          mergeBtn.title = `このタブのメッセージを別のタブに移動し、このタブを削除`;
          mergeBtn.addEventListener('click', () => openMergeTabModal(tab));

          row.appendChild(nameSpan);
          row.appendChild(label);
          row.appendChild(alignSelect);
          row.appendChild(tabHiddenToggle);
          row.appendChild(deleteBtn);
          row.appendChild(mergeBtn);
          fragment.appendChild(row);
      });
      tabSettingsDiv.appendChild(fragment);
  }

  function deleteTab(tabName) {
      displayLogData = displayLogData.filter(item => !(item.type === 'message' && item.tab === tabName));
      uniqueTabsFound.delete(tabName);
      delete tabSettings[tabName];
      visibleTabsInAllMode.delete(tabName);
      // uniqueTabsFound が 'all' しか残らない場合の処理
      const remaining = [...uniqueTabsFound].filter(t => t !== 'all');
      if (remaining.length === 0) {
          uniqueTabsFound = new Set(['all']);
          visibleTabsInAllMode = new Set();
      }
      if (currentTabFilter === tabName) currentTabFilter = 'all';
      populateTabsUI();
      populateTabSettingsUI();
      populateSpeakerFilterUI();
      renderLog();
  }

  function openMergeTabModal(fromTab) {
      const otherTabs = [...uniqueTabsFound].filter(t => t !== 'all' && t !== fromTab).sort((a, b) => a.localeCompare(b));
      if (otherTabs.length === 0) {
          alert('統合先となる他のタブが存在しません。');
          return;
      }
      genericModalTitle.textContent = '他のタブに統合';
      const optionsHtml = otherTabs
          .map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
          .join('');
      genericModalBody.innerHTML = `
          <p class="text-sm text-gray-700 mb-3">
              「<strong>${escapeHtml(fromTab)}</strong>」のメッセージをすべて以下のタブに統合します。<br>
              元のタブ「${escapeHtml(fromTab)}」は削除されます。<br>
              この操作は取り消せません。
          </p>
          <div class="modal-form-group">
              <label for="merge-tab-target-select">統合先タブ:</label>
              <select id="merge-tab-target-select" class="block w-full rounded-md border-gray-300 shadow-sm p-1.5 text-sm">
                  ${optionsHtml}
              </select>
          </div>
      `;
      genericModalConfirmBtn.textContent = '統合する';
      genericModalConfirmBtn.className = 'btn-danger';
      genericModalConfirmBtn.onclick = () => {
          const toTab = document.getElementById('merge-tab-target-select').value;
          closeModal(genericModal);
          mergeTab(fromTab, toTab);
      };
      openModal(genericModal);
  }

  function mergeTab(fromTab, toTab) {
      displayLogData.forEach(item => {
          if (item.type === 'message' && item.tab === fromTab) {
              item.tab = toTab;
          }
      });
      uniqueTabsFound.delete(fromTab);
      delete tabSettings[fromTab];
      visibleTabsInAllMode.delete(fromTab);
      if (currentTabFilter === fromTab) currentTabFilter = toTab;
      populateTabsUI();
      populateTabSettingsUI();
      populateSpeakerFilterUI();
      renderLog();
  }

  function addNewTab(tabName) {
      uniqueTabsFound.add(tabName);
      tabSettings[tabName] = { alignment: 'left' };
      visibleTabsInAllMode.add(tabName);
      if (!uniqueTabsFound.has('all')) uniqueTabsFound.add('all');
      populateTabsUI();
      populateTabSettingsUI();
  }

  function populateSpeakerFilterUI() {
      speakerFilterSelect.innerHTML = '<option value="all">すべての発言者</option>';
      const allKnownSpeakers = new Set([...Object.keys(speakerFrequencies).filter(s => s !== 'system'), ...Object.keys(characterSettings).filter(s => s !== 'system' && characterSettings[s].isNew)]);
      const sortedSpeakers = [...allKnownSpeakers].sort((a, b) => {
          const countA = speakerFrequencies[a] || (characterSettings[a]?.isNew ? -1 : 0);
          const countB = speakerFrequencies[b] || (characterSettings[b]?.isNew ? -1 : 0);
          return countB - countA || a.localeCompare(b);
      });

      if (sortedSpeakers.length === 0) { speakerFilterSelect.disabled = true; return; }
      const fragment = document.createDocumentFragment();
      sortedSpeakers.forEach(speaker => {
          const option = document.createElement('option'); option.value = escapeCssSelector(speaker);
          const count = speakerFrequencies[speaker] || 0;
          const displayName = characterSettings[speaker]?.displayName || speaker;
          option.textContent = `${escapeHtml(displayName)} (${count}回)${characterSettings[speaker]?.isNew ? ' (新規)' : ''}`;
          fragment.appendChild(option);
      });
      speakerFilterSelect.appendChild(fragment);
      try { speakerFilterSelect.value = currentSpeakerFilter === 'all' ? 'all' : escapeCssSelector(currentSpeakerFilter); } catch { speakerFilterSelect.value = 'all'; }
      speakerFilterSelect.disabled = false;
  }

  function handleTabChange(tabName) { 
      if (currentTabFilter === tabName) return; 
      currentTabFilter = tabName; 
      const baseClasses = 'whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors duration-150 ease-in-out'; 
      const activeClasses = 'border-indigo-500 text-indigo-600'; 
      const inactiveClasses = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'; 
      logTabsNav.querySelectorAll('button').forEach(button => { 
          const isActive = button.dataset.tab === tabName; 
          button.className = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`; 
          button.setAttribute('aria-selected', isActive ? 'true' : 'false'); 
      }); 

      if (tabName === 'all' && uniqueTabsFound.size > 1) {
          populateAllModeTabFilterUI();
      } else {
          allModeTabFilterDiv.classList.add('hidden');
      }

      renderLog(); 
  }

  function handleSpeakerFilterChange() {
      const selectedValue = speakerFilterSelect.value;
      const newFilter = selectedValue === 'all' ? 'all' : Object.keys(characterSettings).find(sp => escapeCssSelector(sp) === selectedValue) ||
                        Object.keys(speakerFrequencies).find(sp => escapeCssSelector(sp) === selectedValue) || 'all';
      if (currentSpeakerFilter === newFilter) return;
      currentSpeakerFilter = newFilter; renderLog();
  }

  function renderLog() {
       if (bulkMoveMode) exitBulkMoveMode();
       if (isRenderingLog) {
           console.log("Render already in progress. Skipping.");
           return;
       }
       isRenderingLog = true;
       showLoading();

       FONT_CLASSES.forEach(cls => logDisplayDiv.classList.remove(cls)); logDisplayDiv.classList.add(customizationSettings.fontFamily);
       logDisplayDiv.style.fontSize = `${customizationSettings.fontSize}px`; logDisplayDiv.style.height = `${customizationSettings.logDisplayHeight}px`;
       logDisplayDiv.style.setProperty('--bubble-max-width', `${customizationSettings.bubbleMaxWidth}%`);
       logDisplayDiv.style.setProperty('--icon-size', `${customizationSettings.iconSize}px`);
       applyThemeAwareLogStyles();

       let filteredItems = displayLogData.filter(item => {
           let itemTab = null, itemSpeaker = null;

           if (item.type === 'message') {
               itemTab = item.tab || 'main';
               itemSpeaker = item.speaker || '不明';
           } else if (item.type === 'image') {
               if (item.anchorId === HEADER_IMAGE_ANCHOR) return currentSpeakerFilter === 'all'; // Header images always visible unless speaker filter is on
               const anchorMsg = displayLogData.find(m => m.id === item.anchorId && m.type === 'message');
               if (anchorMsg) {
                   itemTab = anchorMsg.tab || 'main';
                   itemSpeaker = anchorMsg.speaker || '不明';
               } else { // Orphaned image
                   return currentTabFilter === 'all' && currentSpeakerFilter === 'all';
               }
           } else if (item.type === 'heading' || item.type === 'error') {
               return currentSpeakerFilter === 'all'; // Headings/Errors only filtered by speaker
           } else {
               return false;
           }

           if (itemTab && tabSettings[itemTab]?.hidden) return false;

           const speakerMatch = currentSpeakerFilter === 'all' || itemSpeaker === currentSpeakerFilter;
           if (!speakerMatch) return false;

           let tabMatch = false;
           if (currentTabFilter === 'all') {
               if (item.type === 'heading' || item.type === 'error' || (item.type === 'image' && item.anchorId === HEADER_IMAGE_ANCHOR)) {
                   tabMatch = true;
               } else {
                   tabMatch = itemTab ? visibleTabsInAllMode.has(itemTab) : false;
               }
           } else {
               tabMatch = itemTab === currentTabFilter;
           }

           return tabMatch;
       });

       const dataToSort = filteredItems; // displayLogData の配列順が表示順

       logDisplayDiv.innerHTML = '';

       if (dataToSort.length === 0) {
           logDisplayDiv.innerHTML = '<p class="text-gray-500 text-center italic">表示するログがありません。(フィルタ条件を確認してください)</p>';
           updateHeadingsNav();
           hideLoading();
           isRenderingLog = false;
           return;
       }

       let currentIndex = 0;
       function renderChunkOptimized() {
           const fragment = document.createDocumentFragment();
           const chunkEnd = Math.min(currentIndex + RENDER_CHUNK_SIZE, dataToSort.length);

           for (let i = currentIndex; i < chunkEnd; i++) {
               const item = dataToSort[i];
               try {
                   let element;
                   if (item.type === 'message') { element = createMessageElement(item); }
                   else if (item.type === 'image') { element = createInsertedImageElement(item); }
                   else if (item.type === 'error') { element = createErrorElement(item); }
                   else if (item.type === 'heading') { element = createHeadingElement(item); }
                   if (element) fragment.appendChild(element);
               } catch (elementError) {
                   console.error(`   [renderLogChunk] Error creating element for item (ID: ${item.id}, Index: ${i}):`, elementError, item);
                   const errorDiv = document.createElement('div');
                   errorDiv.className = 'p-2 my-1 bg-red-100 border border-red-400 text-red-700 rounded text-sm';
                   errorDiv.textContent = `表示エラー: アイテム(${item.id})の表示中に問題が発生しました。`;
                   fragment.appendChild(errorDiv);
               }
           }
           logDisplayDiv.appendChild(fragment);
           currentIndex = chunkEnd;

           if (currentIndex < dataToSort.length) {
               setTimeout(renderChunkOptimized, RENDER_CHUNK_DELAY);
           } else {
               updateHeadingsNav();
               hideLoading();
               isRenderingLog = false;
           }
       }
       setTimeout(renderChunkOptimized, 0);
  }

  function getMessageRenderState(logItem) {
      const setting = characterSettings[logItem.speaker] || { displayName: logItem.speaker, icon: null, expressions: {}, alignment: 'left', color: '#000000', customTextColor: null, forceNarration: false };
      const isForcedNarration = setting.forceNarration || false;
      const currentDisplayMode = isForcedNarration ? 'narration' : (logItem.displayMode || 'bubble');
      const finalAlignment = customizationSettings.speakerAlignmentMode
          ? (setting.alignment || 'left')
          : (tabSettings[logItem.tab]?.alignment || 'left');
      const messageTextColor = setting.customTextColor ||
        (currentTheme === 'dark' ? customizationSettings.darkBaseTextColor : customizationSettings.baseTextColor);

      const placeholderSrc = PLACEHOLDER_ICON_URL.replace('64x64', `${customizationSettings.iconSize}x${customizationSettings.iconSize}`);
      let currentIconSrc = placeholderSrc;
      const iconKey = logItem.iconKey || 'default';

      if (iconKey === 'override' && logItem.overrideIconSrc) currentIconSrc = logItem.overrideIconSrc;
      else if (iconKey !== 'default' && setting.expressions?.[iconKey]) currentIconSrc = setting.expressions[iconKey];
      else if (setting.icon) currentIconSrc = setting.icon;

      return { setting, isForcedNarration, currentDisplayMode, finalAlignment, messageTextColor, placeholderSrc, currentIconSrc, iconKey };
  }

  function applyMessageBubbleStyle(messageBody, alignment) {
      if (!messageBody) return;
      messageBody.classList.remove('bubble-right');
      if (isRightAlignment(alignment)) messageBody.classList.add('bubble-right');
      const color = getBubbleColorForAlignment(alignment);
      messageBody.style.setProperty('--bubble-bg-color', color);
      messageBody.style.setProperty('--bubble-arrow-color', color);
  }

  function updateMessageElementPresentation(messageElement, logItem) {
      if (!messageElement || !logItem) return;
      const state = getMessageRenderState(logItem);
      const effectiveBubbleAlignment = state.currentDisplayMode === 'bubble' ? state.finalAlignment : 'left';
      const messageContainer = messageElement.querySelector('.message-container');
      const iconImg = messageElement.querySelector('img.message-icon');
      const speakerNameSpan = messageElement.querySelector('.speaker-name-default');
      const messageBody = messageElement.querySelector('.message-body');
      const toggleButton = messageElement.querySelector('.display-mode-toggle');
      messageElement.dataset.displayMode = state.currentDisplayMode;
      if (messageContainer) messageContainer.classList.toggle('align-right', isRightAlignment(effectiveBubbleAlignment));

      if (iconImg) {
          iconImg.src = state.currentIconSrc;
          iconImg.alt = `${state.setting.displayName} icon (${state.iconKey})`;
          iconImg.style.borderColor = state.setting.color || logItem.color || '#000000';
      }

      if (speakerNameSpan) {
          speakerNameSpan.innerHTML = `${escapeHtml(state.setting.displayName)} <span class="text-xs font-normal text-gray-500" style="text-shadow: none;">[${escapeHtml(logItem.tab || 'main')}]</span>`;
          speakerNameSpan.style.color = state.messageTextColor;
      }

      if (messageBody) {
          applyMessageBubbleStyle(messageBody, effectiveBubbleAlignment);
          messageBody.style.color = state.messageTextColor;
      }

      if (toggleButton) {
          toggleButton.textContent = state.currentDisplayMode === 'narration' ? '💬' : '📝';
          toggleButton.disabled = state.isForcedNarration;
          if (state.isForcedNarration) {
              toggleButton.title = 'キャラクター設定により地の文に固定されています';
              toggleButton.style.cursor = 'not-allowed';
          } else {
              toggleButton.title = '表示モード切替 (フキダシ/描写)';
              toggleButton.style.cursor = 'pointer';
          }
      }

      const isHidden = !!logItem.hidden;
      messageElement.dataset.hidden = isHidden ? 'true' : 'false';
      const hideOutputToggle = messageElement.querySelector('.hide-output-toggle');
      if (hideOutputToggle) {
          hideOutputToggle.classList.toggle('active', isHidden);
          hideOutputToggle.title = isHidden ? '出力非表示中 (クリックで解除)' : '出力時に非表示にする';
      }

  }

  function createMessageElement(logItem) {
      if (!logItem || logItem.type !== 'message') return null;
      const container = document.createElement('div'); container.className = 'message-item'; container.dataset.itemId = logItem.id; container.dataset.tab = logItem.tab || 'main'; container.dataset.speaker = logItem.speaker || '不明';
      const state = getMessageRenderState(logItem);
      container.dataset.displayMode = state.currentDisplayMode;

      const messageContainer = document.createElement('div');
      messageContainer.className = 'message-container';

      const iconContainer = document.createElement('div'); iconContainer.className = 'icon-container';
      const iconImg = document.createElement('img'); iconImg.src = state.currentIconSrc; iconImg.alt = `${state.setting.displayName} icon (${state.iconKey})`; iconImg.className = 'w-full h-full rounded-full object-cover icon-border bg-gray-200 message-icon';
      iconImg.style.borderColor = state.setting.color || logItem.color || '#000000';
      iconImg.loading = 'lazy'; iconImg.style.objectPosition = '50% 0%'; iconImg.title = 'クリックしてアイコンを変更';
      iconImg.onerror = (e) => {
          const target = e.target;
          const liveState = getMessageRenderState(logItem);
          const failedSrc = target.src;
          if (failedSrc === liveState.placeholderSrc) return;
          let intendedSrc = liveState.placeholderSrc;
          const currentKey = logItem.iconKey || 'default';
          if (currentKey === 'override' && logItem.overrideIconSrc) intendedSrc = logItem.overrideIconSrc;
          else if (currentKey !== 'default' && liveState.setting.expressions?.[currentKey]) intendedSrc = liveState.setting.expressions[currentKey];
          else if (liveState.setting.icon) intendedSrc = liveState.setting.icon;
          if (failedSrc === intendedSrc) {
              if (currentKey === 'override') target.src = liveState.setting.icon || liveState.placeholderSrc;
              else if (currentKey !== 'default') target.src = liveState.setting.icon || liveState.placeholderSrc;
              else target.src = liveState.placeholderSrc;
          } else {
              target.src = liveState.placeholderSrc;
          }
      };
      iconImg.addEventListener('click', (event) => { event.stopPropagation(); triggerIconSelectionDropdown(logItem.id, logItem.speaker, event.currentTarget); });
      iconContainer.appendChild(iconImg);
      messageContainer.appendChild(iconContainer);

      const contentContainer = document.createElement('div'); contentContainer.className = 'content-container';
      const speakerNameSpan = document.createElement('span'); speakerNameSpan.className = 'speaker-name-default'; speakerNameSpan.innerHTML = `${escapeHtml(state.setting.displayName)} <span class="text-xs font-normal text-gray-500" style="text-shadow: none;">[${escapeHtml(logItem.tab || 'main')}]</span>`;
      speakerNameSpan.style.color = state.messageTextColor;
      speakerNameSpan.title = 'クリックして発言者を変更';
      speakerNameSpan.addEventListener('click', (event) => { event.stopPropagation(); triggerSpeakerSelectionDropdown(logItem.id, event.currentTarget); });

      const messageBody = document.createElement('div');
      messageBody.className = 'bubble message-body bubble-left';
      messageBody.innerHTML = logItem.message;
      messageBody.contentEditable = 'true';
      messageBody.dataset.itemId = logItem.id;
      messageBody.addEventListener('blur', handleMessageEdit);
      contentContainer.appendChild(speakerNameSpan);
      contentContainer.appendChild(messageBody);

      const actionButtonContainer = document.createElement('div'); actionButtonContainer.className = 'action-button-container';
      const advancedActionButtonContainer = document.createElement('div'); advancedActionButtonContainer.className = 'advanced-action-buttons';

    // --- 並び替え / タブ変更 / 挿入 / 削除 ---
    const moveUpBtn = createActionButton('上に移動', 'action-button-tabmove', () => handleMoveItem(logItem.id, -1));
    const moveDownBtn = createActionButton('下に移動', 'action-button-tabmove', () => handleMoveItem(logItem.id, 1));
    const changeTabBtn = createActionButton('タブ変更', 'action-button-custom', (ev) => {
        ev.stopPropagation();
        triggerTabSelectionDropdown(logItem.id, ev.currentTarget);
    });

    // 画像挿入・削除ボタン
    const insertImgBtn = createActionButton('画像挿入', 'action-button-insert', () => triggerImageInsert('after', logItem.id));
    const deleteBtnBubble = createDeleteButton(logItem.id, 'メッセージ');
    if (moveUpBtn) actionButtonContainer.appendChild(moveUpBtn);
    if (moveDownBtn) actionButtonContainer.appendChild(moveDownBtn);
    if (insertImgBtn) actionButtonContainer.appendChild(insertImgBtn);
    if (deleteBtnBubble) actionButtonContainer.appendChild(deleteBtnBubble);
if (changeTabBtn) advancedActionButtonContainer.appendChild(changeTabBtn);
      const addChatBtn = createActionButton('発言追加', 'action-button-custom', () => openAddChatItemModal(logItem.id));
      const addHeadingBtn = createActionButton('見出し追加', 'action-button-custom', () => openAddHeadingModal(logItem.id));
      if (addChatBtn) advancedActionButtonContainer.appendChild(addChatBtn);
      if (addHeadingBtn) advancedActionButtonContainer.appendChild(addHeadingBtn);

      messageContainer.appendChild(contentContainer);
      container.appendChild(messageContainer);
      container.appendChild(actionButtonContainer);
      container.appendChild(advancedActionButtonContainer);

      const hiddenBadge = document.createElement('div');
      hiddenBadge.className = 'hidden-output-badge';
      hiddenBadge.textContent = '🚫 出力非表示';
      container.appendChild(hiddenBadge);

      const hideOutputToggle = document.createElement('button');
      hideOutputToggle.className = 'hide-output-toggle';
      hideOutputToggle.title = '出力時に非表示にする';
      hideOutputToggle.textContent = '⊗';
      hideOutputToggle.onclick = () => toggleMessageHidden(logItem.id);
      container.appendChild(hideOutputToggle);

      const toggleButton = document.createElement('button');
      toggleButton.className = 'display-mode-toggle';
      toggleButton.title = '表示モード切替 (フキダシ/描写)';
      toggleButton.textContent = state.currentDisplayMode === 'narration' ? '💬' : '📝';
      toggleButton.onclick = () => toggleMessageDisplayMode(logItem.id);
      container.appendChild(toggleButton);
      updateMessageElementPresentation(container, logItem);
      return container;
  }

  function createActionButton(text, className, onClick) {
      const button = document.createElement('button');
      button.textContent = text;
      button.className = `action-button ${className}`;
      button.onclick = onClick;
      return button;
  }
  function toggleMessageDisplayMode(itemId) {
      const itemIndex = displayLogData.findIndex(item => item.id === itemId && item.type === 'message'); if (itemIndex === -1) return;

      const setting = characterSettings[displayLogData[itemIndex].speaker];
      if (setting && setting.forceNarration) return; // Do nothing if narration is forced

      const currentMode = displayLogData[itemIndex].displayMode || 'bubble'; const newMode = (currentMode === 'bubble') ? 'narration' : 'bubble'; displayLogData[itemIndex].displayMode = newMode;
      const elementToUpdate = logDisplayDiv.querySelector(`.message-item[data-item-id="${itemId}"]`);
      if (elementToUpdate) {
          updateMessageElementPresentation(elementToUpdate, displayLogData[itemIndex]);
      }
  }
  function toggleMessageHidden(itemId) {
      const itemIndex = displayLogData.findIndex(item => item.id === itemId && item.type === 'message');
      if (itemIndex === -1) return;
      displayLogData[itemIndex].hidden = !displayLogData[itemIndex].hidden;
      const elementToUpdate = logDisplayDiv.querySelector(`.message-item[data-item-id="${itemId}"]`);
      if (elementToUpdate) {
          updateMessageElementPresentation(elementToUpdate, displayLogData[itemIndex]);
      }
  }
  function createInsertedImageElement(imageItem) {
      if (!imageItem || imageItem.type !== 'image') return null;
      const container = document.createElement('div'); container.className = 'inserted-image-container my-2 image-item'; container.dataset.itemId = imageItem.id;
      const isHeaderImage = imageItem.anchorId === HEADER_IMAGE_ANCHOR;
      let dataTab = 'header', dataSpeaker = 'header_img';
      if(!isHeaderImage) {
          const anchorMsg = displayLogData.find(m => m.id === imageItem.anchorId && m.type==='message');
          if (anchorMsg) { dataTab = anchorMsg.tab || 'main'; dataSpeaker = anchorMsg.speaker || '不明'; }
          else { dataTab = 'main'; dataSpeaker = '不明'; }
      }
      container.dataset.tab = dataTab; container.dataset.speaker = dataSpeaker;

      const img = document.createElement('img'); img.src = imageItem.src || ''; img.alt = imageItem.caption ? escapeHtml(imageItem.caption) : `挿入画像 (ID: ${imageItem.id})`; img.className = 'inserted-image'; img.loading = 'lazy';
      img.onerror = (e) => { console.error(`Failed to load inserted image: ${e.target.src}`); const errorP = document.createElement('p'); errorP.className='text-red-500 text-xs text-center font-semibold'; errorP.textContent = `[画像(ID: ${escapeHtml(imageItem.id)})の読み込みに失敗しました]`; const delBtn = createDeleteButton(imageItem.id, '画像'); if(delBtn) errorP.appendChild(delBtn); container.innerHTML = ''; container.appendChild(errorP); };
      container.appendChild(img);
      if (imageItem.caption) { const captionP = document.createElement('p'); captionP.className = 'image-caption'; captionP.textContent = imageItem.caption; container.appendChild(captionP); }
      const actionButtonContainer = document.createElement('div'); actionButtonContainer.className = 'action-button-container justify-center';
      const editCaptionButton = createActionButton('説明編集', 'action-button-edit', () => editImageCaption(imageItem.id));
      const deleteButton = createDeleteButton(imageItem.id, '画像');
      if(editCaptionButton) actionButtonContainer.appendChild(editCaptionButton);
      if(deleteButton) actionButtonContainer.appendChild(deleteButton);
      container.appendChild(actionButtonContainer);
      return container;
   }

  function createErrorElement(errorItem) {
      if (!errorItem || errorItem.type !== 'error') return null;
      const errorDiv = document.createElement('div'); errorDiv.className = 'p-2 my-1 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-sm error-item'; errorDiv.dataset.itemId = errorItem.id; errorDiv.dataset.tab = 'all'; errorDiv.dataset.speaker = 'all';
      errorDiv.innerHTML = `<strong>解析エラー:</strong> ${escapeHtml(errorItem.message)}<br><small class="text-gray-600">内容: ${escapeHtml(errorItem.details)}...</small>`;
      const deleteButton = createDeleteButton(errorItem.id, 'エラー表示'); const buttonContainer = document.createElement('div'); buttonContainer.className = 'mt-1'; if(deleteButton) buttonContainer.appendChild(deleteButton); errorDiv.appendChild(buttonContainer);
      return errorDiv;
  }

  function createHeadingElement(headingItem) {
      if (!headingItem || headingItem.type !== 'heading') return null;
      const div = document.createElement('div');
      div.id = headingItem.id;
      div.className = `heading-item level-${headingItem.level}`;
      div.dataset.itemId = headingItem.id;

      div.style.color = currentTheme === 'dark' ? customizationSettings.darkBaseTextColor : customizationSettings.baseTextColor;

      const textSpan = document.createElement('span');
      textSpan.textContent = headingItem.text;
      textSpan.contentEditable = "true";
      textSpan.style.marginRight = "10px";
      textSpan.addEventListener('blur', (event) => {
          const itemId = div.dataset.itemId;
          const newText = event.target.textContent.trim();
          const itemIndex = displayLogData.findIndex(item => item.id === itemId && item.type === 'heading');
          if (itemIndex !== -1 && displayLogData[itemIndex].text !== newText) {
              displayLogData[itemIndex].text = newText;
              updateHeadingsNav();
          }
      });
      div.appendChild(textSpan);

      const actionContainer = document.createElement('div');
      actionContainer.className = 'action-button-container';
      actionContainer.style.display = 'inline-flex';
      actionContainer.style.verticalAlign = 'middle';

      const deleteBtn = createDeleteButton(headingItem.id, '見出し');
      if (deleteBtn) actionContainer.appendChild(deleteBtn);

      div.appendChild(actionContainer);
      return div;
  }

  function createDeleteButton(itemId, itemTypeLabel = 'アイテム') {
      const deleteButton = document.createElement('button');
      deleteButton.textContent = '削除';
      deleteButton.className = 'action-button action-button-delete';
      deleteButton.onclick = () => deleteSingleItem(itemId);
      deleteButton.setAttribute('aria-label', `${itemTypeLabel} (ID: ${itemId}) を削除`);
      return deleteButton;
  }

  function triggerImageInsert(position, referenceItemId) {
    imageInsertTarget = { type: position, itemId: referenceItemId };
    insertImageInput.click();
  }

  async function handleInsertImageFile(event) {
      const file = event.target.files?.[0];
      const { type: insertType, itemId: referenceItemId } = imageInsertTarget;
      imageInsertTarget = { type: null, itemId: null };
      if (event.target) event.target.value = null; if (!file) return;
      if (referenceItemId === null && insertType !== 'header') {console.warn("Image insert: No reference item ID and not a header image."); return; }

      if (!file.type.startsWith('image/')) { alert('画像ファイルのみ挿入できます。'); return; }
      if (file.size > MAX_INSERT_IMAGE_SIZE_BYTES) { alert(`ファイルサイズ超過。${MAX_INSERT_IMAGE_SIZE_MB}MB以下にしてください。`); return; }
      const caption = ""; showLoading();
      try {
          const dataUrl = await readFileAsDataURL(file); const imageId = generateUniqueId('img');
          let anchorIdToUse = referenceItemId;
          if (insertType === 'header') anchorIdToUse = HEADER_IMAGE_ANCHOR;

          const newImageEntry = { type: 'image', id: imageId, src: dataUrl, anchorId: anchorIdToUse, caption: caption, isNew: true };

          let insertAtIndex;
          if (insertType === 'header') {
              insertAtIndex = 0;
          } else {
              const refItemIndex = displayLogData.findIndex(item => item.id === referenceItemId);
              if (refItemIndex === -1) throw new Error("参照アイテムが見つかりません。");
              if (insertType === 'after') {
                  // 同メッセージに紐付く既存画像の末尾に挿入
                  insertAtIndex = refItemIndex + 1;
                  while (insertAtIndex < displayLogData.length &&
                         displayLogData[insertAtIndex].type === 'image' &&
                         displayLogData[insertAtIndex].anchorId === referenceItemId) {
                      insertAtIndex++;
                  }
              } else {
                  insertAtIndex = refItemIndex;
              }
          }
          displayLogData.splice(insertAtIndex, 0, newImageEntry);
          uploadedFiles[imageId] = new File([await file.arrayBuffer()], file.name, { type: file.type });

          const newElement = createInsertedImageElement(newImageEntry);
          if (newElement) {
              if (insertType === 'header') {
                  logDisplayDiv.insertBefore(newElement, logDisplayDiv.firstChild);
              } else {
                  const referenceElement = logDisplayDiv.querySelector(`[data-item-id="${referenceItemId}"]`);
                  if (referenceElement) {
                      if (insertType === 'after') {
                          if (referenceElement.nextElementSibling) {
                              logDisplayDiv.insertBefore(newElement, referenceElement.nextElementSibling);
                          } else {
                              logDisplayDiv.appendChild(newElement);
                          }
                      } else {
                          logDisplayDiv.insertBefore(newElement, referenceElement);
                      }
                  } else {
                       logDisplayDiv.appendChild(newElement);
                  }
              }
          }
      } catch (error) { console.error("Error inserting image:", error); alert(`画像の挿入中にエラー: ${error.message}`); }
      finally { hideLoading(); }
  }

  function editImageCaption(itemId) {
      const imageItemIndex = displayLogData.findIndex(item => item.id === itemId && item.type === 'image'); if (imageItemIndex === -1) { alert("キャプション編集対象の画像が見つかりません。"); return; }
      const currentCaption = displayLogData[imageItemIndex].caption || ""; const newCaption = prompt("画像の説明文（キャプション）を編集してください:", currentCaption);
      if (newCaption !== null) {
          displayLogData[imageItemIndex].caption = newCaption.trim();
          const imageElement = logDisplayDiv.querySelector(`.inserted-image-container[data-item-id="${itemId}"]`);
          if (imageElement) {
              let captionP = imageElement.querySelector('.image-caption');
              if (displayLogData[imageItemIndex].caption) {
                  if (!captionP) {
                      captionP = document.createElement('p');
                      captionP.className = 'image-caption';
                      const buttonContainer = imageElement.querySelector('.action-button-container');
                      if (buttonContainer) imageElement.insertBefore(captionP, buttonContainer);
                      else imageElement.appendChild(captionP);
                  }
                  captionP.textContent = displayLogData[imageItemIndex].caption;
                  const imgTag = imageElement.querySelector('img.inserted-image');
                  if(imgTag) imgTag.alt = displayLogData[imageItemIndex].caption;

              } else {
                  if (captionP) captionP.remove();
                  const imgTag = imageElement.querySelector('img.inserted-image');
                  if(imgTag) imgTag.alt = `挿入画像 (ID: ${itemId})`;
              }
          }
      }
  }

  function deleteSingleItem(itemId) {
      if (!itemId) return;
      const indexToDelete = displayLogData.findIndex(item => item.id === itemId);
      if (indexToDelete === -1) { alert('削除対象が見つかりません。'); return; }

      const itemToDelete = displayLogData[indexToDelete];
      const itemTypeLabel = itemToDelete.type === 'message' ? 'メッセージ' : itemToDelete.type === 'image' ? '画像' : itemToDelete.type === 'heading' ? '見出し' : 'エラー表示';
      if (!(customizationSettings.skipDeleteConfirm || confirm(`ID: ${itemId} の${itemTypeLabel}を削除しますか？ (元に戻せません)`))) return;

      displayLogData.splice(indexToDelete, 1);

      let fileKeyToRemove = null;
      if (itemToDelete.type === 'image') { fileKeyToRemove = itemId; }
      else if (itemToDelete.type === 'message' && itemToDelete.iconKey === 'override' && itemToDelete.overrideIconSrc) { fileKeyToRemove = `icon_msg_${itemId}`; }
      if (fileKeyToRemove && uploadedFiles[fileKeyToRemove]) { delete uploadedFiles[fileKeyToRemove]; }

      const elementToRemove = logDisplayDiv.querySelector(`[data-item-id="${itemId}"]`);
      if (elementToRemove) {
          elementToRemove.remove();
      }

      if (itemToDelete.type === 'heading') updateHeadingsNav();
      if (itemToDelete.type === 'message') recomputeFilterState();
  }

  function handleMessageEdit(event) {
      const editedElement = event.target; const itemId = editedElement.dataset.itemId; const newContent = editedElement.innerHTML; if (!itemId) return;
      const itemIndex = displayLogData.findIndex(item => item.id === itemId && item.type === 'message'); if (itemIndex === -1) return;
      if (displayLogData[itemIndex].message !== newContent) { displayLogData[itemIndex].message = newContent; }
  }

  function triggerIconSelectionDropdown(messageId, speaker, clickedIconElement) {
      closeIconDropdown(); const dropdown = iconSelectDropdown; dropdown.innerHTML = ''; messageIconChangeTargetId = messageId;
      const setting = characterSettings[speaker] || { expressions: {}, icon: null }; const fragment = document.createDocumentFragment();
      const defaultBtn = createDropdownButton('default', 'デフォルトアイコン', speaker, 'default'); if (setting.icon) defaultBtn.insertBefore(createDropdownIconPreview(setting.icon), defaultBtn.firstChild); fragment.appendChild(defaultBtn);
      const expressions = setting.expressions || {}; const sortedExpNames = Object.keys(expressions).sort();
      if (sortedExpNames.length > 0) { const separator = document.createElement('div'); separator.className = 'icon-select-separator'; fragment.appendChild(separator); sortedExpNames.forEach(expName => { const btn = createDropdownButton(expName, escapeHtml(expName), speaker, 'expression'); if (expressions[expName]) btn.insertBefore(createDropdownIconPreview(expressions[expName]), btn.firstChild); fragment.appendChild(btn); }); }
      const separator2 = document.createElement('div'); separator2.className = 'icon-select-separator'; fragment.appendChild(separator2);
      const overrideBtn = createDropdownButton('override', 'ファイルから個別設定...', speaker, 'override'); fragment.appendChild(overrideBtn);

      const separator3 = document.createElement('div'); separator3.className = 'icon-select-separator'; fragment.appendChild(separator3);
      const toggleRow = document.createElement('label'); toggleRow.className = 'icon-select-subsequent-toggle';
      const toggleCheckbox = document.createElement('input'); toggleCheckbox.type = 'checkbox'; toggleCheckbox.checked = applyIconToSubsequent;
      toggleCheckbox.addEventListener('change', (e) => { applyIconToSubsequent = e.target.checked; e.stopPropagation(); });
      toggleRow.appendChild(toggleCheckbox);
      toggleRow.appendChild(document.createTextNode(' 以降の全アイコンを変更'));
      fragment.appendChild(toggleRow);

      dropdown.appendChild(fragment); const rect = clickedIconElement.getBoundingClientRect();
      dropdown.style.top = `${window.scrollY + rect.bottom + 5}px`; dropdown.style.left = `${window.scrollX + rect.left}px`;
      dropdown.classList.remove('hidden'); currentDropdown = dropdown; document.addEventListener('click', handleClickOutsideDropdown, true);
  }
  function createDropdownButton(key, text, speaker, type) { const button = document.createElement('button'); button.textContent = text; button.dataset.key = key; button.dataset.speaker = speaker; button.dataset.type = type; button.onclick = handleMessageIconSelection; return button; }
  function createDropdownIconPreview(src) { const img = document.createElement('img'); img.src = src; img.alt = ''; img.onerror = (e) => { e.target.style.display = 'none'; }; return img; }

  function updateMessageIconElement(messageElement, logItem) {
      updateMessageElementPresentation(messageElement, logItem);
  }

  function handleMessageIconSelection(event) {
      const button = event.currentTarget; const key = button.dataset.key; const type = button.dataset.type; const messageId = messageIconChangeTargetId; closeIconDropdown(); if (!messageId) return;
      const itemIndex = displayLogData.findIndex(item => item.id === messageId && item.type === 'message'); if (itemIndex === -1) return;

      if (type === 'override') {
          messageIconChangeTargetId = messageId;
          iconChangeInput.onchange = handleOverrideIconUpload;
          iconChangeInput.click();
      } else {
           const logItem = displayLogData[itemIndex];
           logItem.iconKey = key;
           if (logItem.overrideIconSrc) {
               const overrideFileKey = `icon_msg_${messageId}`;
               if (uploadedFiles[overrideFileKey]) delete uploadedFiles[overrideFileKey];
               logItem.overrideIconSrc = null;
           }
           messageIconChangeTargetId = null;
           const messageElement = logDisplayDiv.querySelector(`.message-item[data-item-id="${messageId}"]`);
           if (messageElement) updateMessageIconElement(messageElement, logItem);

           if (applyIconToSubsequent) {
               const targetSpeaker = logItem.speaker;
               for (let i = itemIndex + 1; i < displayLogData.length; i++) {
                   const subsequent = displayLogData[i];
                   if (subsequent.type !== 'message' || subsequent.speaker !== targetSpeaker) continue;
                   subsequent.iconKey = key;
                   if (subsequent.overrideIconSrc) {
                       const subOverrideKey = `icon_msg_${subsequent.id}`;
                       if (uploadedFiles[subOverrideKey]) delete uploadedFiles[subOverrideKey];
                       subsequent.overrideIconSrc = null;
                   }
                   const subEl = logDisplayDiv.querySelector(`.message-item[data-item-id="${subsequent.id}"]`);
                   if (subEl) updateMessageIconElement(subEl, subsequent);
               }
           }
       }
  }
  async function handleOverrideIconUpload(event) {
      const file = event.target.files?.[0]; const targetMessageId = messageIconChangeTargetId; iconChangeInput.onchange = null; if (event.target) event.target.value = null; if (!file || !targetMessageId) { messageIconChangeTargetId = null; return; }
      if (!file.type.startsWith('image/')) { alert('画像ファイルを選択してください。'); messageIconChangeTargetId = null; return; } if (file.size > MAX_FILE_SIZE_BYTES) { alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB以下にしてください。`); messageIconChangeTargetId = null; return; }
      showLoading();
      try {
          const dataUrl = await readFileAsDataURL(file); const messageIndex = displayLogData.findIndex(item => item.id === targetMessageId && item.type === 'message'); if (messageIndex === -1) throw new Error(`Message item ${targetMessageId} not found.`);
          const logItem = displayLogData[messageIndex];
          logItem.iconKey = 'override'; logItem.overrideIconSrc = dataUrl;
          const uploadKey = `icon_msg_${targetMessageId}`;
          uploadedFiles[uploadKey] = new File([await file.arrayBuffer()], file.name, { type: file.type });

          const messageElement = logDisplayDiv.querySelector(`.message-item[data-item-id="${targetMessageId}"]`);
          if (messageElement) {
              updateMessageIconElement(messageElement, logItem);
          }
      } catch (error) { console.error(`Error processing override icon upload for ${targetMessageId}:`, error); alert(`個別アイコンの読み込みに失敗しました: ${error.message}`); const messageIndex = displayLogData.findIndex(item => item.id === targetMessageId); if(messageIndex !== -1 && displayLogData[messageIndex].type === 'message' && displayLogData[messageIndex].iconKey === 'override') { displayLogData[messageIndex].iconKey = 'default'; displayLogData[messageIndex].overrideIconSrc = null; const messageElement = logDisplayDiv.querySelector(`.message-item[data-item-id="${targetMessageId}"]`); if (messageElement) updateMessageIconElement(messageElement, displayLogData[messageIndex]); } }
      finally { hideLoading(); messageIconChangeTargetId = null; }
  }
  function closeIconDropdown() { if (currentDropdown) { currentDropdown.classList.add('hidden'); currentDropdown.innerHTML = ''; currentDropdown = null; document.removeEventListener('click', handleClickOutsideDropdown, true); } }
  function handleClickOutsideDropdown(event) { if (currentDropdown && !currentDropdown.contains(event.target)) { const clickedOnIcon = event.target.closest('.message-icon'); if (!clickedOnIcon) closeIconDropdown(); } }

  // --- Speaker / Tab dropdowns (editor) ---
  function showSimpleSelectDropdown(anchorEl, options, currentValue, onSelect) {
      // Close any existing dropdown (reuse the same global currentDropdown handler)
      closeIconDropdown();
      const dropdown = document.createElement('div');
      dropdown.className = 'icon-select-dropdown'; // reuse existing positioning styles
      dropdown.style.position = 'fixed';
      dropdown.style.zIndex = '9999';
      dropdown.style.padding = '6px';
      dropdown.style.minWidth = '180px';

      const select = document.createElement('select');
      select.style.width = '100%';
      select.style.padding = '6px';
      select.style.border = '1px solid #ccc';
      select.style.borderRadius = '6px';
      options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.value === currentValue) o.selected = true;
          select.appendChild(o);
      });
      dropdown.appendChild(select);

      document.body.appendChild(dropdown);
      currentDropdown = dropdown;

      const rect = anchorEl.getBoundingClientRect();
      const top = Math.min(window.innerHeight - 10, rect.bottom + 6);
      const left = Math.min(window.innerWidth - 10, rect.left);
      dropdown.style.top = `${top}px`;
      dropdown.style.left = `${left}px`;

      const cleanup = () => closeIconDropdown();
      select.addEventListener('change', () => {
          const v = select.value;
          cleanup();
          onSelect(v);
      });

      // Close on outside click
      setTimeout(() => document.addEventListener('click', handleClickOutsideDropdown, true), 0);
      select.focus();
  }

  function triggerSpeakerSelectionDropdown(messageId, anchorEl) {
      const item = displayLogData.find(d => d.id === messageId && d.type === 'message');
      if (!item) return;
      const speakers = Object.keys(characterSettings || {});
      const options = speakers.map(s => ({ value: s, label: characterSettings[s]?.displayName ? `${characterSettings[s].displayName} (${s})` : s }));
      showSimpleSelectDropdown(anchorEl, options, item.speaker || speakers[0] || '不明', (selectedSpeaker) => {
          applySpeakerChange(messageId, selectedSpeaker);
      });
  }

  function triggerTabSelectionDropdown(messageId, anchorEl) {
      const item = displayLogData.find(d => d.id === messageId && d.type === 'message');
      if (!item) return;
      // existing tabs from current data
      const tabsSet = new Set();
      displayLogData.forEach(d => {
          if (d.type === 'message') tabsSet.add(d.tab || 'main');
      });
      const tabs = Array.from(tabsSet).sort();
      const options = tabs.map(t => ({ value: t, label: t }));
      showSimpleSelectDropdown(anchorEl, options, item.tab || 'main', (selectedTab) => {
          applyTabChange(messageId, selectedTab);
      });
  }

  function recomputeFilterState() {
      // speakerFrequencies と uniqueTabsFound を displayLogData から再計算し、
      // フィルタUIを再構築する。発言者/タブ変更・追加・削除の後に呼ぶ。
      speakerFrequencies = {};
      const newTabs = new Set();
      displayLogData.forEach(item => {
          if (item.type !== 'message') return;
          if (item.speaker && item.speaker !== 'system' && item.speaker !== '不明') {
              speakerFrequencies[item.speaker] = (speakerFrequencies[item.speaker] || 0) + 1;
          }
          if (item.tab) newTabs.add(item.tab);
      });

      uniqueTabsFound = newTabs.size > 0 ? new Set([...newTabs, 'all']) : new Set(['all', 'main']);

      // visibleTabsInAllMode: 消えたタブを除去し、新規タブを追加
      const validTabs = new Set([...uniqueTabsFound].filter(t => t !== 'all'));
      [...visibleTabsInAllMode].forEach(t => { if (!validTabs.has(t)) visibleTabsInAllMode.delete(t); });
      validTabs.forEach(t => { if (!visibleTabsInAllMode.has(t)) visibleTabsInAllMode.add(t); });

      // 存在しなくなったタブ/発言者を参照しているフィルタをリセット
      if (currentTabFilter !== 'all' && !uniqueTabsFound.has(currentTabFilter)) currentTabFilter = 'all';
      if (currentSpeakerFilter !== 'all' && !speakerFrequencies[currentSpeakerFilter] && !characterSettings[currentSpeakerFilter]?.isNew) currentSpeakerFilter = 'all';

      populateTabsUI();
      populateTabSettingsUI();
      populateSpeakerFilterUI();
      if (currentTabFilter === 'all') populateAllModeTabFilterUI();
  }

  function applySpeakerChange(messageId, newSpeaker) {
      const idx = displayLogData.findIndex(d => d.id === messageId && d.type === 'message');
      if (idx === -1) return;
      const item = displayLogData[idx];
      item.speaker = newSpeaker;

      // reset icon to default for the new speaker
      item.iconKey = 'default';
      item.overrideIconSrc = null;

      // adopt new speaker color if available
      const setting = characterSettings[newSpeaker];
      if (setting?.color) item.color = setting.color;

      updateSingleItemInDomOrRemove(item);
      recomputeFilterState();
  }

  function applyTabChange(messageId, newTab) {
      const idx = displayLogData.findIndex(d => d.id === messageId && d.type === 'message');
      if (idx === -1) return;
      const item = displayLogData[idx];
      item.tab = newTab;
      updateSingleItemInDomOrRemove(item);
      recomputeFilterState();
  }

  function isItemVisibleInCurrentEditorView(item) {
      // Mirror renderLog() filter logic for a single item
      let itemTab = null, itemSpeaker = null;

      if (item.type === 'message') {
          itemTab = item.tab || 'main';
          itemSpeaker = item.speaker || '不明';
      } else if (item.type === 'image') {
          if (item.anchorId === HEADER_IMAGE_ANCHOR) return currentSpeakerFilter === 'all';
          const anchorMsg = displayLogData.find(m => m.id === item.anchorId && m.type === 'message');
          if (anchorMsg) {
              itemTab = anchorMsg.tab || 'main';
              itemSpeaker = anchorMsg.speaker || '不明';
          } else {
              return currentTabFilter === 'all' && currentSpeakerFilter === 'all';
          }
      } else if (item.type === 'heading' || item.type === 'error') {
          return currentSpeakerFilter === 'all';
      } else {
          return false;
      }

      const speakerMatch = currentSpeakerFilter === 'all' || itemSpeaker === currentSpeakerFilter;
      if (!speakerMatch) return false;

      if (currentTabFilter === 'all') {
          if (item.type === 'heading' || item.type === 'error' || (item.type === 'image' && item.anchorId === HEADER_IMAGE_ANCHOR)) return true;
          return itemTab ? visibleTabsInAllMode.has(itemTab) : false;
      }
      return itemTab === currentTabFilter;
  }

  function updateSingleItemInDomOrRemove(item) {
      const el = logDisplayDiv.querySelector(`[data-item-id="${item.id}"]`);
      const visible = isItemVisibleInCurrentEditorView(item);

      if (!visible) {
          if (el) el.remove();
          return;
      }
      const newEl = (item.type === 'message') ? createMessageElement(item)
                  : (item.type === 'image') ? createInsertedImageElement(item)
                  : (item.type === 'heading') ? createHeadingElement(item)
                  : (item.type === 'error') ? createErrorElement(item)
                  : null;
      if (!newEl) return;

      if (el) el.replaceWith(newEl);
      else logDisplayDiv.appendChild(newEl); // fallback
  }

  // --- Ordering / Move ---
  function getCurrentEditorViewSortedItems() {
      return displayLogData.filter(isItemVisibleInCurrentEditorView);
  }

  function handleMoveItem(itemId, direction) {
      const view = getCurrentEditorViewSortedItems();
      const idx = view.findIndex(it => it.id === itemId);
      if (idx === -1) return;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= view.length) return;

      const a = view[idx];
      const b = view[targetIdx];

      // displayLogData 内の実インデックスを取得してswap
      const aIdx = displayLogData.indexOf(a);
      const bIdx = displayLogData.indexOf(b);
      displayLogData[aIdx] = b;
      displayLogData[bIdx] = a;

      // DOM swap
      const aEl = logDisplayDiv.querySelector(`[data-item-id="${a.id}"]`);
      const bEl = logDisplayDiv.querySelector(`[data-item-id="${b.id}"]`);
      if (aEl && bEl && aEl.parentNode === bEl.parentNode) {
          if (direction === 1) {
              logDisplayDiv.insertBefore(bEl, aEl);
          } else {
              logDisplayDiv.insertBefore(aEl, bEl);
          }
      } else {
          updateSingleItemInDomOrRemove(a);
          updateSingleItemInDomOrRemove(b);
      }
  }

  function toggleHeadingsNav() {
      isHeadingsNavOpen = !isHeadingsNavOpen;
      headingsNavPanel.classList.toggle('open', isHeadingsNavOpen);
      document.body.classList.toggle('headings-nav-open', isHeadingsNavOpen);
      toggleHeadingsNavBtn.textContent = isHeadingsNavOpen ? '閉' : '見';
      toggleHeadingsNavBtn.title = isHeadingsNavOpen ? "見出し一覧を隠す" : "見出し一覧を表示";
  }

  function closeHeadingsNav() {
      if (isHeadingsNavOpen) toggleHeadingsNav();
  }

  function updateHeadingsNav() {
      headingsListUl.innerHTML = '';
      const headingsInDisplayOrder = displayLogData.filter(item => item.type === 'heading');

      if (headingsInDisplayOrder.length === 0) {
          headingsListUl.innerHTML = '<li class="no-headings">見出しはありません</li>';
          return;
      }

      headingsInDisplayOrder.forEach(heading => {
          const li = document.createElement('li');
          li.className = `level-${heading.level}`;
          const a = document.createElement('a');
          a.href = `#${heading.id}`;
          a.textContent = heading.text;
          a.title = `「${heading.text}」へジャンプ`;
          a.onclick = (e) => {
              e.preventDefault();
              const targetElement = document.getElementById(heading.id);
              if (targetElement) {
                  targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
          };
          li.appendChild(a);
          headingsListUl.appendChild(li);
      });
  }

  // --- Customization Specific Functions ---
  async function handleBackgroundImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        backgroundImageInput.value = null; return;
    }
    if (file.size > MAX_INSERT_IMAGE_SIZE_BYTES) {
        alert(`ファイルサイズが大きすぎます。${MAX_INSERT_IMAGE_SIZE_MB}MB以下にしてください。`);
        backgroundImageInput.value = null; return;
    }
    showLoading();
    try {
        const dataUrl = await readFileAsDataURL(file);
        customizationSettings.backgroundImage = dataUrl;
        customizationSettings.backgroundImageFileName = file.name;
        uploadedFiles[BACKGROUND_IMAGE_KEY] = new File([await file.arrayBuffer()], file.name, { type: file.type });
        backgroundImagePreview.src = dataUrl;
        backgroundImagePreview.classList.add('has-image');
        applyCustomization();
    } catch (error) {
        console.error("Error processing background image:", error);
        alert(`背景画像の読み込みエラー: ${error.message}`);
        customizationSettings.backgroundImage = null;
        customizationSettings.backgroundImageFileName = null;
        delete uploadedFiles[BACKGROUND_IMAGE_KEY];
        backgroundImagePreview.src = '';
        backgroundImagePreview.classList.remove('has-image');
    } finally {
        hideLoading();
        backgroundImageInput.value = null;
    }
  }

  function clearBackgroundImage() {
    customizationSettings.backgroundImage = null;
    customizationSettings.backgroundImageFileName = null;
    delete uploadedFiles[BACKGROUND_IMAGE_KEY];
    backgroundImagePreview.src = '';
    backgroundImagePreview.classList.remove('has-image');
    applyCustomization();
  }

  function applyCustomization() {
      try {
          customizationSettings.normalBubbleColor = normalColorInput.value;
          customizationSettings.rightBubbleColor = rightBubbleColorInput.value;
          customizationSettings.fontSize = parseInt(fontSizeSlider.value, 10) || 16;
          customizationSettings.backgroundColor = backgroundColorInput.value;
          customizationSettings.iconSize = parseInt(iconSizeSlider.value, 10) || 64;
          customizationSettings.bubbleMaxWidth = parseInt(bubbleWidthSlider.value, 10) || 80;
          customizationSettings.fontFamily = fontFamilySelect.value;
          customizationSettings.logDisplayHeight = parseInt(logHeightSlider.value, 10) || 960;
          customizationSettings.skipDeleteConfirm = skipDeleteConfirmToggle.checked;
          customizationSettings.baseTextColor = baseTextColorInput.value;
          customizationSettings.textEdgeColor = textEdgeColorInput.value;
          customizationSettings.darkNormalBubbleColor = darkNormalColorInput.value;
          customizationSettings.darkRightBubbleColor  = darkRightColorInput.value;
          customizationSettings.darkBgColor           = darkBgColorInput.value.trim() || 'rgba(0,0,0,0.30)';
          customizationSettings.darkBaseTextColor     = darkBaseTextColorInput.value;
          customizationSettings.darkTextEdgeColor     = darkTextEdgeColorInput.value;
          customizationSettings.includeThemeToggle    = includeThemeToggleInput.checked;
          const prevSpeakerMode = customizationSettings.speakerAlignmentMode;
          customizationSettings.speakerAlignmentMode = speakerAlignmentModeToggle ? speakerAlignmentModeToggle.checked : false;
          if (prevSpeakerMode !== customizationSettings.speakerAlignmentMode) {
              populateTabSettingsUI();
              populateCharacterSettingsUI();
          }

          renderLog();
      } catch (error) { console.error("Error applying customization:", error); alert(`カスタマイズ適用エラー: ${error.message}`); }
  }
  function resetCustomizationDefaults() {
      customizationSettings = {
          normalBubbleColor: '#ffffff',     darkNormalBubbleColor: '#2d2d2d',
          rightBubbleColor: '#dcf8c6',      darkRightBubbleColor: '#29342f',
          fontSize: 16, backgroundColor: '#f3f4f6', darkBgColor: 'rgba(0,0,0,0.30)',
          iconSize: 64, bubbleMaxWidth: 80,
          fontFamily: 'font-noto-sans', logDisplayHeight: 960,
          skipDeleteConfirm: false,
          baseTextColor: '#333333',         darkBaseTextColor: '#e8e8e8',
          textEdgeColor: '#ffffff',         darkTextEdgeColor: 'transparent',
          backgroundImage: null,
          backgroundImageFileName: null,
          includeThemeToggle: false,
          speakerAlignmentMode: false,
          customBubbleColors: [
              { light: '#c6f8f8', dark: '#303044' },
              { light: '#ffd6d6', dark: '#3a2020' }
          ]
      };
      delete uploadedFiles[BACKGROUND_IMAGE_KEY];
  }
  function resetCustomization() {
      resetCustomizationDefaults();
      updateCustomizationUI();
      applyCustomization();
      alert('表示カスタマイズをリセットしました。');
  }
  function updateCustomizationUI() {
      try {
          normalColorInput.value = customizationSettings.normalBubbleColor;
          rightBubbleColorInput.value = customizationSettings.rightBubbleColor;
          fontSizeSlider.value = customizationSettings.fontSize; fontSizeValueSpan.textContent = customizationSettings.fontSize; backgroundColorInput.value = customizationSettings.backgroundColor; iconSizeSlider.value = customizationSettings.iconSize; iconSizeValueSpan.textContent = customizationSettings.iconSize; bubbleWidthSlider.value = customizationSettings.bubbleMaxWidth; bubbleWidthValueSpan.textContent = customizationSettings.bubbleMaxWidth; fontFamilySelect.value = customizationSettings.fontFamily; logHeightSlider.value = customizationSettings.logDisplayHeight; logHeightValueSpan.textContent = customizationSettings.logDisplayHeight; skipDeleteConfirmToggle.checked = customizationSettings.skipDeleteConfirm;
          baseTextColorInput.value = customizationSettings.baseTextColor;
          textEdgeColorInput.value = customizationSettings.textEdgeColor;
          if (darkNormalColorInput) {
              const dnv = customizationSettings.darkNormalBubbleColor || '#2d2d2d';
              darkNormalColorInput.value = dnv.startsWith('#') ? dnv : '#2d2d2d';
          }
          if (darkRightColorInput) {
              const drv = customizationSettings.darkRightBubbleColor || '#29342f';
              darkRightColorInput.value = drv.startsWith('#') ? drv : '#29342f';
          }
          if (darkBgColorInput) darkBgColorInput.value = customizationSettings.darkBgColor || 'rgba(0,0,0,0.30)';
          if (darkBaseTextColorInput) darkBaseTextColorInput.value = customizationSettings.darkBaseTextColor || '#e8e8e8';
          if (darkTextEdgeColorInput) darkTextEdgeColorInput.value = customizationSettings.darkTextEdgeColor || 'transparent';
          if (includeThemeToggleInput) includeThemeToggleInput.checked = !!customizationSettings.includeThemeToggle;
          if (speakerAlignmentModeToggle) speakerAlignmentModeToggle.checked = !!customizationSettings.speakerAlignmentMode;

          if (customizationSettings.backgroundImage && customizationSettings.backgroundImageFileName) {
              backgroundImagePreview.src = customizationSettings.backgroundImage;
              backgroundImagePreview.classList.add('has-image');
          } else {
              backgroundImagePreview.src = '';
              backgroundImagePreview.classList.remove('has-image');
          }
       } catch (error) { console.error("Error updating customization UI:", error); }
       refreshColorSwatches();
       renderCustomBubbleColorsUI();
   }
   function refreshColorSwatches() {
       [['dark-bg-color',            'dark-bg-color-swatch'],
        ['dark-text-edge-color',     'dark-text-edge-color-swatch'],
       ].forEach(([inputId, swatchId]) => {
           const input = document.getElementById(inputId);
           const swatch = document.getElementById(swatchId);
           if (input && swatch) swatch.style.setProperty('--swatch-color', input.value.trim() || 'transparent');
       });
   }
   function renderCustomBubbleColorsUI() {
       const list = document.getElementById('custom-bubble-colors-list');
       if (!list) return;
       list.innerHTML = '';
       const colors = customizationSettings.customBubbleColors || [];
       colors.forEach((c, i) => {
           const row = document.createElement('div');
           row.className = 'flex items-center gap-2 p-2 border border-gray-200 rounded';
           row.innerHTML = `
               <span class="text-xs text-gray-600 w-16 flex-shrink-0">カスタム${i+1}</span>
               <label class="text-xs text-gray-500">ライト</label>
               <input type="color" value="${c.light}" class="h-7 w-12 rounded border border-gray-300 cursor-pointer p-0.5" data-custom-idx="${i}" data-custom-mode="light">
               <label class="text-xs text-gray-500">ダーク</label>
               <input type="color" value="${c.dark}" class="h-7 w-12 rounded border border-gray-300 cursor-pointer p-0.5" data-custom-idx="${i}" data-custom-mode="dark">
               <button class="ml-auto text-xs px-2 py-0.5 border border-red-400 text-red-500 rounded hover:bg-red-50" data-delete-custom="${i}">削除</button>`;
           list.appendChild(row);
       });
       list.querySelectorAll('input[type="color"][data-custom-idx]').forEach(input => {
           input.addEventListener('input', (e) => {
               const idx = parseInt(e.target.dataset.customIdx);
               const mode = e.target.dataset.customMode;
               if (customizationSettings.customBubbleColors[idx]) {
                   customizationSettings.customBubbleColors[idx][mode] = e.target.value;
                   renderLog();
               }
           });
       });
       list.querySelectorAll('button[data-delete-custom]').forEach(btn => {
           btn.addEventListener('click', (e) => {
               const idx = parseInt(e.target.dataset.deleteCustom);
               deleteCustomBubbleColor(idx);
           });
       });
   }
   function addCustomBubbleColor() {
       if (!customizationSettings.customBubbleColors) customizationSettings.customBubbleColors = [];
       customizationSettings.customBubbleColors.push({ light: '#ffffff', dark: '#2d2d2d' });
       renderCustomBubbleColorsUI();
       refreshAlignmentDropdowns();
       renderLog();
   }
   function deleteCustomBubbleColor(idx) {
       const colors = customizationSettings.customBubbleColors || [];
       if (idx < 0 || idx >= colors.length) return;
       const deletedKey1 = `left-custom-${idx+1}`;
       const deletedKey2 = `right-custom-${idx+1}`;
       colors.splice(idx, 1);
       // 削除されたカスタム色を使っていたタブ/キャラを 'left' に戻し、それより後の番号を繰り上げ
       const renum = (align) => {
           if (align === deletedKey1 || align === deletedKey2) return 'left';
           const m = align && align.match(/^(left|right)-custom-(\d+)$/);
           if (m && parseInt(m[2]) > idx + 1) return `${m[1]}-custom-${parseInt(m[2]) - 1}`;
           return align;
       };
       Object.keys(tabSettings).forEach(tab => {
           if (tabSettings[tab]?.alignment) tabSettings[tab].alignment = renum(tabSettings[tab].alignment);
       });
       Object.keys(characterSettings).forEach(sp => {
           if (characterSettings[sp]?.alignment) characterSettings[sp].alignment = renum(characterSettings[sp].alignment);
       });
       renderCustomBubbleColorsUI();
       refreshAlignmentDropdowns();
       renderLog();
   }
   function refreshAlignmentDropdowns() {
       populateTabSettingsUI();
       if (customizationSettings.speakerAlignmentMode) populateCharacterSettingsUI();
   }

  // ── まとめて移動モード ──
  function enterBulkMoveMode() {
      if (displayLogData.length === 0) return;
      bulkMoveMode = true;
      bulkMoveSelected = [];
      bulkMoveButton.textContent = 'キャンセル';
      bulkMoveButton.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
      bulkMoveButton.classList.add('bg-red-500', 'hover:bg-red-600');
      logDisplayDiv.classList.add('bulk-move-active');
      // ヒントバナーを先頭に追加
      const banner = document.createElement('div');
      banner.className = 'bm-hint-banner';
      banner.id = 'bm-hint-banner';
      banner.textContent = 'メッセージをクリックして選択 → メッセージ間をクリックして移動 | Escキーでキャンセル';
      logDisplayDiv.prepend(banner);
      _insertBulkMoveBars();
      logDisplayDiv.addEventListener('click',     _bulkMoveCaptureHandler, { capture: true });
      logDisplayDiv.addEventListener('mousedown', _bulkMoveMousedownCapture, { capture: true });
      document.addEventListener('keydown', _bulkMoveKeydownHandler);
  }

  function exitBulkMoveMode() {
      if (!bulkMoveMode) return;
      bulkMoveMode = false;
      bulkMoveSelected = [];
      bulkMoveButton.textContent = 'メッセージを纏めて移動';
      bulkMoveButton.classList.remove('bg-red-500', 'hover:bg-red-600');
      bulkMoveButton.classList.add('bg-indigo-500', 'hover:bg-indigo-600');
      logDisplayDiv.classList.remove('bulk-move-active');
      document.getElementById('bm-hint-banner')?.remove();
      logDisplayDiv.querySelectorAll('.bm-insert-bar').forEach(el => el.remove());
      logDisplayDiv.querySelectorAll('.message-item.bm-selected').forEach(el => {
          el.classList.remove('bm-selected');
          el.style.position = '';
      });
      logDisplayDiv.querySelectorAll('.bm-order-badge').forEach(el => el.remove());
      logDisplayDiv.removeEventListener('click',     _bulkMoveCaptureHandler, { capture: true });
      logDisplayDiv.removeEventListener('mousedown', _bulkMoveMousedownCapture, { capture: true });
      document.removeEventListener('keydown', _bulkMoveKeydownHandler);
  }

  function _insertBulkMoveBars() {
      const visibleItems = [...logDisplayDiv.children].filter(
          el => !el.classList.contains('hidden-log-item') &&
                !el.classList.contains('bm-hint-banner') &&
                el.dataset.itemId
      );
      for (let i = 0; i < visibleItems.length - 1; i++) {
          const bar = document.createElement('div');
          bar.className = 'bm-insert-bar';
          bar.dataset.insertAfterId = visibleItems[i].dataset.itemId;
          bar.addEventListener('click', (e) => {
              e.stopPropagation();
              _executeBulkMove(bar.dataset.insertAfterId);
          });
          visibleItems[i].after(bar);
      }
  }

  function _bulkMoveCaptureHandler(e) {
      if (!bulkMoveMode) return;
      const messageEl = e.target.closest('.message-item');
      if (!messageEl) return;
      e.stopPropagation();
      e.preventDefault();
      _toggleBulkMoveSelection(messageEl);
  }
  // mousedown をキャプチャして contenteditable フォーカスや各種リスナーを完全遮断
  function _bulkMoveMousedownCapture(e) {
      if (!bulkMoveMode) return;
      if (e.target.closest('.message-item') || e.target.closest('.bm-insert-bar')) {
          e.stopPropagation();
          e.preventDefault();
      }
  }

  function _bulkMoveKeydownHandler(e) {
      if (e.key === 'Escape') exitBulkMoveMode();
  }

  function _toggleBulkMoveSelection(messageEl) {
      const id = messageEl.dataset.itemId;
      if (!id) return;
      const idx = bulkMoveSelected.indexOf(id);
      if (idx !== -1) {
          bulkMoveSelected.splice(idx, 1);
          messageEl.classList.remove('bm-selected');
          messageEl.style.position = '';
          messageEl.querySelector('.bm-order-badge')?.remove();
          _updateBulkMoveNumbers();
      } else {
          bulkMoveSelected.push(id);
          messageEl.classList.add('bm-selected');
          messageEl.style.position = 'relative';
          const badge = document.createElement('div');
          badge.className = 'bm-order-badge';
          badge.textContent = bulkMoveSelected.length;
          messageEl.appendChild(badge);
      }
  }

  function _updateBulkMoveNumbers() {
      bulkMoveSelected.forEach((id, i) => {
          const el = logDisplayDiv.querySelector(`.message-item[data-item-id="${id}"] .bm-order-badge`);
          if (el) el.textContent = i + 1;
      });
  }

  function _executeBulkMove(insertAfterId) {
      if (bulkMoveSelected.length === 0) return;
      const selectedItems = bulkMoveSelected
          .map(id => displayLogData.find(item => item.id === id))
          .filter(Boolean);
      if (selectedItems.length === 0) { exitBulkMoveMode(); return; }

      // 挿入位置を特定: insertAfterIdが選択済みなら手前の非選択アイテムまで遡る
      let anchorOrigIdx = displayLogData.findIndex(item => item.id === insertAfterId);
      while (anchorOrigIdx >= 0 && bulkMoveSelected.includes(displayLogData[anchorOrigIdx].id)) {
          anchorOrigIdx--;
      }

      const remaining = displayLogData.filter(item => !bulkMoveSelected.includes(item.id));

      if (anchorOrigIdx < 0) {
          // 先頭より前になってしまう → 挿入しない
          exitBulkMoveMode();
          return;
      }
      const anchorId = displayLogData[anchorOrigIdx].id;
      const insertPos = remaining.findIndex(item => item.id === anchorId);
      if (insertPos === -1) { exitBulkMoveMode(); return; }

      remaining.splice(insertPos + 1, 0, ...selectedItems);
      displayLogData.length = 0;
      remaining.forEach(item => displayLogData.push(item));

      exitBulkMoveMode();
      renderLog();
  }
   function saveCustomization() { try { localStorage.setItem(LOCALSTORAGE_CUSTOMIZATION_KEY, JSON.stringify(customizationSettings)); } catch (error) { console.error("Error saving customization settings to LocalStorage:", error); } }
   function loadCustomization() {
      let loaded = null; try { const savedJson = localStorage.getItem(LOCALSTORAGE_CUSTOMIZATION_KEY); if (savedJson) loaded = JSON.parse(savedJson); } catch (error) { console.error("Error loading customization settings from LocalStorage:", error); localStorage.removeItem(LOCALSTORAGE_CUSTOMIZATION_KEY); }
      if (loaded) {
          Object.assign(customizationSettings, loaded);
          // rgba値が保存されていた場合は新デフォルトに移行
          if (!customizationSettings.darkNormalBubbleColor.startsWith('#')) customizationSettings.darkNormalBubbleColor = '#2d2d2d';
          if (!customizationSettings.darkRightBubbleColor.startsWith('#')) customizationSettings.darkRightBubbleColor = '#29342f';
          if (!Array.isArray(customizationSettings.customBubbleColors)) customizationSettings.customBubbleColors = [{ light: '#c6f8f8', dark: '#303044' }, { light: '#ffd6d6', dark: '#3a2020' }];
      } else { resetCustomizationDefaults(); }
  }

  async function saveProject() {
      if (displayLogData.length === 0) { alert('保存するログデータがありません。'); return; } if (typeof JSZip === 'undefined') { alert('ZIP作成ライブラリ(JSZip)の読み込みに失敗しました...'); return; }
      const projectName = exportHtmlTitleInput.value.trim() || logFileNameBase || 'log_project'; const zipFilenameBase = exportZipFilenameInput.value.trim() || logFileNameBase || 'log_project'; const projectFilename = `${zipFilenameBase}${PROJECT_FILE_EXTENSION}`;
      showLoading();
      try {
          const zip = new JSZip(); const imgFolder = zip.folder(PROJECT_IMAGES_FOLDER.replace('/', ''));
          if (!imgFolder) throw new Error("Failed to create 'images' folder in ZIP.");

          const projectData = {
              fileFormatVersion: PROJECT_FILE_FORMAT_VERSION, toolVersion: APP_VERSION, createdAt: new Date().toISOString(),
              logFileNameBase: logFileNameBase, characterSettings: {},
              exportHtmlTitle: exportHtmlTitleInput.value.trim() || logFileNameBase,
              exportZipFilename: exportZipFilenameInput.value.trim() || logFileNameBase,
              customizationSettings: { ...customizationSettings },
              tabSettings: { ...tabSettings },
              displayLogData: [], uploadedFileManifest: {}, nextUniqueId: nextUniqueId,
              currentFilters: { tab: currentTabFilter, speaker: currentSpeakerFilter }
          };
          projectData.customizationSettings.backgroundImage = null;
          projectData.customizationSettings.backgroundImagePath = null;

          const imagePathMap = new Map(); const addedFiles = new Set();
          for (const [key, fileObject] of Object.entries(uploadedFiles)) {
              if (!(fileObject instanceof Blob)) { console.warn(`Skipping non-Blob entry in uploadedFiles: ${key}`); continue; }
              const imagePath = getImagePathForKey(key, fileObject);
              if (imagePath && !addedFiles.has(imagePath)) {
                  try {
                      imgFolder.file(imagePath.substring(PROJECT_IMAGES_FOLDER.length), fileObject);
                      addedFiles.add(imagePath);
                      imagePathMap.set(key, imagePath);

                      let manifestEntry = { type: 'unknown' };
                      if (key === BACKGROUND_IMAGE_KEY) {
                          manifestEntry = { type: 'backgroundImage', fileName: customizationSettings.backgroundImageFileName };
                          projectData.customizationSettings.backgroundImagePath = imagePath;
                      }
                      else if (key.startsWith('img_')) manifestEntry = { type: 'insertedImage', imageId: key };
                      else if (key.startsWith('icon_msg_')) manifestEntry = { type: 'overrideIcon', messageId: key.substring(9) };
                      else if (key.startsWith('exp_')) { const parts = key.match(/^exp_(.+?)_(.+)$/); if(parts) manifestEntry = { type: 'expressionIcon', speaker: parts[1], expressionName: parts[2] }; }
                      else if (key.startsWith('newchar_')) manifestEntry = { type: 'newCharIcon', speaker: key.substring(8) };
                      else manifestEntry = { type: 'defaultIcon', speaker: key };
                      projectData.uploadedFileManifest[imagePath] = manifestEntry;
                  } catch (zipError) { console.error(`Error adding image (key: ${key}, path: ${imagePath}) to zip:`, zipError); }
              }
               else if (imagePath && addedFiles.has(imagePath)) {
                  imagePathMap.set(key, imagePath);
                  if (key === BACKGROUND_IMAGE_KEY) {
                      projectData.customizationSettings.backgroundImagePath = imagePath;
                  }
              } else { console.warn(`Could not generate image path for key: ${key}`); }
          }

          for (const [speaker, setting] of Object.entries(characterSettings)) {
              const newSetting = {
                  displayName: setting.displayName,
                  iconPath: imagePathMap.get(setting.isNew ? `newchar_${speaker}` : speaker) || null,
                  expressions: {},
                  alignment: setting.alignment || 'left',
                  color: setting.color || '#000000',
                  customTextColor: setting.customTextColor,
                  forceNarration: !!setting.forceNarration,
                  isNew: !!setting.isNew
              };
              if (setting.expressions) { for (const [expName, _] of Object.entries(setting.expressions)) { const expKey = `exp_${speaker}_${expName}`; newSetting.expressions[expName] = imagePathMap.get(expKey) || null; } }
              projectData.characterSettings[speaker] = newSetting;
          }
          projectData.displayLogData = displayLogData.map(item => {
              if (item.type === 'message') {
                  const newItem = { ...item }; delete newItem.overrideIconSrc;
                  const overrideKey = `icon_msg_${item.id}`;
                  newItem.overrideIconPath = (item.iconKey === 'override') ? (imagePathMap.get(overrideKey) || null) : null;
                  return newItem;
              } else if (item.type === 'image') {
                  const newItem = { ...item }; delete newItem.src;
                  newItem.srcPath = imagePathMap.get(item.id) || null;
                  return newItem;
              } else if (item.type === 'heading' || item.type === 'error') {
                  return { ...item };
              }
              return null;
          }).filter(item => item !== null);

          zip.file(PROJECT_DATA_FILENAME, JSON.stringify(projectData, null, 2));
          const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
          const downloadUrl = URL.createObjectURL(zipBlob); const link = document.createElement('a'); link.href = downloadUrl; link.download = projectFilename; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
          alert(`プロジェクトを保存しました: ${link.download}`);
      } catch (error) { console.error("Error saving project:", error); alert(`プロジェクト保存エラー: ${error.message}`); }
      finally { hideLoading(); }
  }

  async function loadProject(projectFile) {
      if (typeof JSZip === 'undefined') throw new Error('ZIPライブラリ(JSZip)が見つかりません。');
      const zip = await JSZip.loadAsync(projectFile); const projectDataFile = zip.file(PROJECT_DATA_FILENAME);
      if (!projectDataFile) throw new Error(`${PROJECT_DATA_FILENAME} が見つかりません。`);
      const projectDataJson = await projectDataFile.async('string'); let projectData;
      try { projectData = JSON.parse(projectDataJson); } catch (e) { throw new Error(`${PROJECT_DATA_FILENAME} 解析エラー: ${e.message}`); }

      logFileNameBase = projectData.logFileNameBase || 'loaded_project';
      exportHtmlTitleInput.value = projectData.exportHtmlTitle || logFileNameBase;
      exportZipFilenameInput.value = projectData.exportZipFilename || logFileNameBase;
      const defaultCustomization = {
          normalBubbleColor: '#ffffff', darkNormalBubbleColor: '#2d2d2d',
          rightBubbleColor: '#dcf8c6',  darkRightBubbleColor: '#29342f',
          fontSize: 16, backgroundColor: '#f3f4f6', darkBgColor: 'rgba(0,0,0,0.30)',
          iconSize: 64, bubbleMaxWidth: 80, fontFamily: 'font-noto-sans',
          logDisplayHeight: 960, skipDeleteConfirm: false,
          baseTextColor: '#333333', darkBaseTextColor: '#e8e8e8',
          textEdgeColor: '#ffffff', darkTextEdgeColor: 'transparent',
          backgroundImage: null, backgroundImageFileName: null, backgroundImagePath: null,
          includeThemeToggle: false,
          customBubbleColors: [{ light: '#c6f8f8', dark: '#303044' }, { light: '#ffd6d6', dark: '#3a2020' }]
      };
      customizationSettings = { ...defaultCustomization, ...projectData.customizationSettings };
      if (typeof customizationSettings.textEdgeColor === 'undefined') customizationSettings.textEdgeColor = defaultCustomization.textEdgeColor;
      if (!customizationSettings.darkNormalBubbleColor.startsWith('#')) customizationSettings.darkNormalBubbleColor = '#2d2d2d';
      if (!customizationSettings.darkRightBubbleColor.startsWith('#')) customizationSettings.darkRightBubbleColor = '#29342f';
      if (!Array.isArray(customizationSettings.customBubbleColors)) customizationSettings.customBubbleColors = [{ light: '#c6f8f8', dark: '#303044' }, { light: '#ffd6d6', dark: '#3a2020' }];
      if (typeof customizationSettings.backgroundImageFileName === 'undefined') customizationSettings.backgroundImageFileName = defaultCustomization.backgroundImageFileName;

      nextUniqueId = projectData.nextUniqueId || 0;
      const filters = projectData.currentFilters || { tab: 'all', speaker: 'all' };
      currentTabFilter = filters.tab; currentSpeakerFilter = filters.speaker;

      characterSettings = {};
      if (projectData.characterSettings) {
          for (const [speaker, loadedSetting] of Object.entries(projectData.characterSettings)) {
              characterSettings[speaker] = { // Temporary load, paths will be replaced by DataURLs
                  displayName: loadedSetting.displayName,
                  icon: loadedSetting.iconPath,
                  expressions: loadedSetting.expressions || {},
                  alignment: loadedSetting.alignment || 'left',
                  color: loadedSetting.color || '#000000',
                  customTextColor: loadedSetting.customTextColor || null,
                  forceNarration: !!loadedSetting.forceNarration,
                  isNew: !!loadedSetting.isNew
              };
          }
      }

      speakerFilenameAlias = {}; nextAliasId = 0;
      expressionAliasMap = {}; nextExpressionAliasId = 0;
      if (projectData.characterSettings) {
          Object.entries(projectData.characterSettings).forEach(([speaker, setting]) => {
              if (speaker !== 'system' && speaker !== '不明' && !speakerFilenameAlias[speaker]) {
                  if (/^[a-zA-Z0-9_]+$/.test(speaker)) {
                      speakerFilenameAlias[speaker] = speaker;
                  } else {
                      speakerFilenameAlias[speaker] = `char_${nextAliasId++}`;
                  }
              }
              if (setting.expressions) {
                  expressionAliasMap[speaker] = {};
                  Object.keys(setting.expressions).forEach(expName => {
                      if (!expressionAliasMap[speaker][expName]) {
                          expressionAliasMap[speaker][expName] = `emote_${nextExpressionAliasId++}`;
                      }
                  });
              }
          });
      }

      const imageFolder = zip.folder(PROJECT_IMAGES_FOLDER.replace('/', '')); const imageDataUrlMap = new Map(); const newUploadedFiles = {};
      if (imageFolder) {
          const imagePromises = [];
          imageFolder.forEach((relativePath, zipEntry) => {
              if (zipEntry.dir) return; const fullPath = `${PROJECT_IMAGES_FOLDER}${relativePath}`;
              const promise = zipEntry.async('blob').then(blob => {
                  const filename = relativePath;
                  const imageFile = createFileFromBlob(blob, filename);
                  if (!imageFile) { throw new Error(`Failed to create File object for ${filename}`); }
                  return readFileAsDataURL(imageFile).then(dataUrl => {
                      imageDataUrlMap.set(fullPath, dataUrl);
                      const manifestEntry = projectData.uploadedFileManifest?.[fullPath];
                      if (manifestEntry) {
                          let key = null;
                          if (manifestEntry.type === 'backgroundImage') {
                              key = BACKGROUND_IMAGE_KEY;
                              customizationSettings.backgroundImage = dataUrl;
                              customizationSettings.backgroundImageFileName = manifestEntry.fileName;
                          }
                          else if (manifestEntry.type === 'defaultIcon') key = manifestEntry.speaker;
                          else if (manifestEntry.type === 'newCharIcon') key = `newchar_${manifestEntry.speaker}`;
                          else if (manifestEntry.type === 'expressionIcon') key = `exp_${manifestEntry.speaker}_${manifestEntry.expressionName}`;
                          else if (manifestEntry.type === 'overrideIcon') key = `icon_msg_${manifestEntry.messageId}`;
                          else if (manifestEntry.type === 'insertedImage') key = manifestEntry.imageId;
                          if (key) newUploadedFiles[key] = imageFile;
                      }
                  });
              }).catch(err => { console.error(`Error reading image ${relativePath}:`, err); imageDataUrlMap.set(fullPath, null); });
              imagePromises.push(promise);
          });
          await Promise.all(imagePromises); uploadedFiles = newUploadedFiles;
      }
      if (customizationSettings.backgroundImagePath && !customizationSettings.backgroundImage) {
          const bgDataUrl = imageDataUrlMap.get(customizationSettings.backgroundImagePath);
          if (bgDataUrl) {
              customizationSettings.backgroundImage = bgDataUrl;
          }
      }

      // Re-populate characterSettings with DataURLs
      for (const [speaker, setting] of Object.entries(characterSettings)) {
          setting.icon = setting.icon ? (imageDataUrlMap.get(setting.icon) || null) : null;
          if (setting.expressions) {
              for (const [expName, expPath] of Object.entries(setting.expressions)) {
                  if (expPath) {
                      setting.expressions[expName] = imageDataUrlMap.get(expPath) || null;
                  } else {
                      delete setting.expressions[expName];
                  }
              }
          }
      }

      displayLogData = [];
      if (projectData.displayLogData) {
          displayLogData = projectData.displayLogData.map(item => {
              if (item.type === 'message') {
                  const newItem = { ...item };
                  if (item.iconKey === 'override' && item.overrideIconPath) { newItem.overrideIconSrc = imageDataUrlMap.get(item.overrideIconPath) || null; }
                  delete newItem.overrideIconPath;
                  return newItem;
              } else if (item.type === 'image' && item.srcPath) {
                  const newItem = { ...item }; newItem.src = imageDataUrlMap.get(item.srcPath) || null; delete newItem.srcPath; return newItem;
              } else if (item.type === 'heading' || item.type === 'error') {
                  return { ...item };
              }
              return null;
          }).filter(item => item !== null);

          // 旧形式（originalIndex/insertOrder あり）の場合、1回だけソートして正規化
          if (displayLogData.some(item => item.originalIndex !== undefined)) {
              const typeSortOrder = { heading: 1, message: 2, image: 3, error: 4 };
              displayLogData.sort((a, b) =>
                  ((a.originalIndex || 0) - (b.originalIndex || 0)) ||
                  ((a.insertOrder || 0) - (b.insertOrder || 0)) ||
                  ((typeSortOrder[a.type] || 99) - (typeSortOrder[b.type] || 99))
              );
              displayLogData.forEach(item => { delete item.originalIndex; delete item.insertOrder; });
          }
      }
       speakerFrequencies = {}; uniqueTabsFound = new Set();
       displayLogData.forEach(item => {
           if (item.type === 'message') { if(item.speaker && item.speaker !== 'system' && item.speaker !== '不明') { speakerFrequencies[item.speaker] = (speakerFrequencies[item.speaker] || 0) + 1; } if (item.tab) { uniqueTabsFound.add(item.tab); } }
           else if (item.type === 'image' && item.anchorId !== HEADER_IMAGE_ANCHOR) { const anchorMsg = displayLogData.find(m => m.id === item.anchorId && m.type === 'message'); if (anchorMsg?.tab) uniqueTabsFound.add(anchorMsg.tab); }
       });
       if(uniqueTabsFound.size > 0 && !uniqueTabsFound.has('all')) uniqueTabsFound.add('all');
       else if (uniqueTabsFound.size === 0) uniqueTabsFound = new Set(['all', 'main']);

       visibleTabsInAllMode = new Set([...uniqueTabsFound].filter(t => t !== 'all'));

       if (projectData.tabSettings) {
           // 新形式: tabSettingsをそのまま読み込み
           tabSettings = {};
           [...uniqueTabsFound].filter(t => t !== 'all').forEach(tab => {
               tabSettings[tab] = { alignment: (projectData.tabSettings[tab]?.alignment || 'left'), hidden: !!(projectData.tabSettings[tab]?.hidden) };
           });
       } else {
           // 旧形式: 各タブの最初のメッセージのalignmentから推定してコンバート
           tabSettings = {};
           [...uniqueTabsFound].filter(t => t !== 'all').forEach(tab => {
               const firstMsg = displayLogData.find(item => item.type === 'message' && item.tab === tab);
               let alignment = 'left';
               if (firstMsg) {
                   const charSetting = characterSettings[firstMsg.speaker] || {};
                   alignment = firstMsg.alignmentOverride || charSetting.alignment || 'left';
               }
               tabSettings[tab] = { alignment };
           });
       }
       // alignmentOverrideは不要になったので削除
       displayLogData.forEach(item => { if (item.type === 'message') delete item.alignmentOverride; });

      updateSpeakerDataForExport(); populateCharacterSettingsUI(); updateCustomizationUI(); populateTabsUI(); populateTabSettingsUI(); populateSpeakerFilterUI(); renderLog();
  }

  async function handleExportZip() {
      const htmlTitle = exportHtmlTitleInput.value.trim() || logFileNameBase || 'session_log_export';
      const zipFilenameBase = exportZipFilenameInput.value.trim() || logFileNameBase || 'session_log_export';
      const zipFilename = `${zipFilenameBase}.zip`;
      const itemsToExport = displayLogData;
      if (itemsToExport.length === 0) { alert('エクスポートするデータがありません。'); return; } if (typeof JSZip === 'undefined') { alert('ZIP作成ライブラリ(JSZip)の読み込みに失敗しました...'); return; }
      showLoading();
      try {
          const zip = new JSZip();
          const rawCss = generateOutputCss(customizationSettings);
          const minifiedCss = generateMinifiedCss(rawCss);
          zip.file("style.css", minifiedCss);
          const outputHtml = generateOutputHtml(itemsToExport, uniqueTabsFound, speakerDataForExport, htmlTitle, customizationSettings, "", tabSettings);
          zip.file("log_export.html", outputHtml);
          const imgFolder = zip.folder("images"); if (!imgFolder) throw new Error("Failed to create 'images' folder.");
          const addedFiles = new Set();
           for (const [key, fileObject] of Object.entries(uploadedFiles)) {
               if (!(fileObject instanceof Blob)) continue; const imagePath = getImagePathForKey(key, fileObject);
               if (imagePath && !addedFiles.has(imagePath)) { try { imgFolder.file(imagePath.substring(PROJECT_IMAGES_FOLDER.length), fileObject); addedFiles.add(imagePath); } catch (zipAddError) { console.error(`Error adding file ${imagePath} to ZIP:`, zipAddError); } }
           }
           // ダークモード背景 img/bg.webp を同梱
           try {
               const bgResp = await fetch('./img/bg.webp');
               if (bgResp.ok) { zip.folder('img').file('bg.webp', await bgResp.blob()); }
           } catch(_) {}
           const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
           const downloadUrl = URL.createObjectURL(zipBlob); const link = document.createElement('a'); link.href = downloadUrl; link.download = zipFilename; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
           alert(`エクスポート完了: ${link.download}`);
       } catch (error) { console.error(`Error during ZIP export:`, error); alert(`ZIPエクスポートエラー: ${error.message}`); }
       finally { hideLoading(); }
  }

  function buildSingleFileImageAttributes(source, singleFileOptions) {
      if (!source) return 'src=""';
      const safeSource = escapeHtml(source);
      if (!singleFileOptions || !singleFileOptions.assetPayload || !singleFileOptions.sourceToAssetId) {
          return `src="${safeSource}"`;
      }

      const assetData = source.startsWith('data:') ? source : (singleFileOptions.imageDataUrlMap?.get(source) || null);
      if (!assetData) {
          return `src="${safeSource}"`;
      }

      const assetLookupKey = assetData;
      let assetId = singleFileOptions.sourceToAssetId.get(assetLookupKey);
      if (!assetId) {
          assetId = `asset_${singleFileOptions.sourceToAssetId.size}`;
          singleFileOptions.sourceToAssetId.set(assetLookupKey, assetId);
          singleFileOptions.assetPayload[assetId] = assetData;
      }

      return `src="${escapeHtml(SINGLE_FILE_IMAGE_PLACEHOLDER_DATA_URL)}" data-asset-id="${assetId}"`;
  }

  async function handleExportSingleHtml() {
      const htmlTitle = exportHtmlTitleInput.value.trim() || logFileNameBase || 'session_log_export';
      const fileBase = exportZipFilenameInput.value.trim() || logFileNameBase || 'session_log_export';
      const htmlFilename = `${fileBase}.html`;

      const itemsToExport = displayLogData;
      if (itemsToExport.length === 0) { alert('エクスポートするデータがありません。'); return; }

      showLoading();
      try {
          const rawCss = generateOutputCss(customizationSettings, { isSingleFileHtml: true });
          let minifiedCss = generateMinifiedCss(rawCss);

          const imageDataUrlMap = new Map();
          const conversions = [];
          for (const [key, fileObject] of Object.entries(uploadedFiles)) {
              if (!(fileObject instanceof Blob)) continue;
              const imagePath = getImagePathForKey(key, fileObject);
              if (!imagePath || imageDataUrlMap.has(imagePath)) continue;
              conversions.push((async (k, fo, ip) => {
                  let dataUrl;
                  if (k.startsWith('img_')) {
                      // 挿入画像（チャットアイコン用）: 圧縮しない
                      dataUrl = await blobToDataUrl(fo);
                  } else if (k === 'bg_image') {
                      // 背景画像: 白背景JPEG、大きい場合は縮小
                      dataUrl = await convertBlobToCompressedDataURL(fo, { maxDim: 1200, quality: 0.72, whiteBg: true });
                  } else {
                      // キャラクターアイコン等: 透明部分を白で合成してJPEG
                      dataUrl = await convertBlobToCompressedDataURL(fo, { maxDim: 512, quality: 0.75, whiteBg: true });
                  }
                  imageDataUrlMap.set(ip, dataUrl);
              })(key, fileObject, imagePath));
          }
          await Promise.all(conversions);

          // CSSクラス方式: 画像ごとに .rr_asset_N { background-image: url(...) } を生成
          const assetCssRules = [];
          const assetClassMap = new Map(); // source(path or dataUrl) → className

          const singleFileExportOptions = {
              imageDataUrlMap,
              assetClassMap,
              assetCssRules,
          };
          let outputHtml = generateOutputHtml(itemsToExport, uniqueTabsFound, speakerDataForExport, htmlTitle, customizationSettings, singleFileExportOptions, tabSettings);

          // CSS内の画像パスをdata URLで置換（background-image等）
          for (const [imagePath, dataUrl] of imageDataUrlMap.entries()) {
              minifiedCss = minifiedCss.split(imagePath).join(dataUrl);
          }

          // スタイルタグ: 通常CSS + アセットCSSクラスを結合して埋め込む
          const assetCss = assetCssRules.join('');
          outputHtml = outputHtml.replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>${minifiedCss}${assetCss}</style>`);
          if (!outputHtml.includes('<style>')) {
              outputHtml = outputHtml.replace(/<\/head>/i, `<style>${minifiedCss}${assetCss}</style>\n</head>`);
          }

          const blob = new Blob([outputHtml], { type: 'text/html;charset=utf-8' });
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = htmlFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
          alert(`エクスポート完了: ${htmlFilename}`);
      } catch (error) {
          console.error('Error during HTML export:', error);
          alert(`HTMLエクスポートエラー: ${error.message}`);
      } finally {
          hideLoading();
      }
  }

  function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
          reader.readAsDataURL(blob);
      });
  }

  function convertBlobToCompressedDataURL(blob, options = {}) {
      // options: { maxDim, quality, whiteBg }
      // maxDim: null = auto (256 for small, 512 for large), number = override
      // quality: JPEG quality (0-1), default 0.75
      // whiteBg: composite onto white background and output JPEG (ignores alpha)
      const { maxDim: maxDimOverride = null, quality = 0.75, whiteBg = false } = options;
      return new Promise((resolve, reject) => {
          try {
              const reader = new FileReader();
              reader.onload = () => {
                  const srcDataUrl = reader.result;
                  const img = new Image();
                  img.onload = () => {
                      try {
                          const autoMaxDim = (img.width <= 256 && img.height <= 256) ? 256 : 512;
                          const maxDim = maxDimOverride ?? autoMaxDim;
                          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                          const w = Math.max(1, Math.round(img.width * scale));
                          const h = Math.max(1, Math.round(img.height * scale));

                          const canvas = document.createElement('canvas');
                          canvas.width = w;
                          canvas.height = h;

                          let out = '';
                          if (whiteBg) {
                              // 白背景に合成してJPEG出力（透明部分も白になる）
                              const ctx = canvas.getContext('2d', { alpha: false });
                              ctx.imageSmoothingEnabled = true;
                              ctx.imageSmoothingQuality = 'high';
                              ctx.fillStyle = '#ffffff';
                              ctx.fillRect(0, 0, w, h);
                              ctx.drawImage(img, 0, 0, w, h);
                              try { out = canvas.toDataURL('image/jpeg', quality); } catch (_e) { out = ''; }
                          } else {
                              // 透明ピクセルがあればPNG、なければJPEG
                              const ctx = canvas.getContext('2d', { alpha: true });
                              ctx.imageSmoothingEnabled = true;
                              ctx.imageSmoothingQuality = 'high';
                              ctx.drawImage(img, 0, 0, w, h);
                              const imageData = ctx.getImageData(0, 0, w, h);
                              const hasAlpha = imageData.data.some((v, i) => i % 4 === 3 && v < 255);
                              if (hasAlpha) {
                                  try { out = canvas.toDataURL('image/png'); } catch (_e) { out = ''; }
                              } else {
                                  try { out = canvas.toDataURL('image/jpeg', quality); } catch (_e) { out = ''; }
                              }
                          }
                          if (!out || out === 'data:,') out = srcDataUrl;
                          resolve(out);
                      } catch (e) {
                          resolve(srcDataUrl);
                      }
                  };
                  img.onerror = () => resolve(srcDataUrl);
                  img.src = srcDataUrl;
              };
              reader.onerror = () => reject(reader.error || new Error('Failed to read image blob'));
              reader.readAsDataURL(blob);
          } catch (e) {
              reject(e);
          }
      });
  }

  function generateOutputHtml(dataForExport, uniqueTabs, speakerData, htmlTitle, currentCustomization, outputOptionsRaw, tabSettingsData) {
      const outputOptions = (outputOptionsRaw && typeof outputOptionsRaw === 'object') ? outputOptionsRaw : {};
      const { iconSize, fontFamily, normalBubbleColor, baseTextColor, rightBubbleColor, textEdgeColor, backgroundImageFileName } = currentCustomization;
      let logBodyContent = ''; let headingsForNavOutput = [];

      dataForExport.forEach((item, index) => {
          try {
               // Note: Tab boundary separators are generated dynamically in the exported viewer (no static <hr>).
              if (item.hidden) return;
              if (item.type === 'message' && tabSettingsData?.[item.tab]?.hidden) return;
              if (item.type === 'message') {
                  const charSettingFull = characterSettings[item.speaker] || { displayName: item.speaker, icon: null, expressions: {}, alignment: 'left', color: '#000000', customTextColor: null, forceNarration: false };
                  const speakerName = charSettingFull.displayName; const originalSpeaker = item.speaker;
                  const finalAlignment = customizationSettings.speakerAlignmentMode
                      ? (charSettingFull.alignment || 'left')
                      : ((tabSettingsData && tabSettingsData[item.tab])?.alignment || 'left');
                  const finalDisplayMode = (speakerData[originalSpeaker] && speakerData[originalSpeaker].forceNarration) ? 'narration' : (item.displayMode || 'bubble');

                  const messageTextColor = charSettingFull.customTextColor || baseTextColor;
                  let textStyle = `color: ${messageTextColor};`;

                  let iconRelativePath = ''; let hasIconFile = false; let iconFileKey = null;
                  const iconKey = item.iconKey || 'default'; const messageId = item.id;
                  if (iconKey === 'override') { iconFileKey = `icon_msg_${messageId}`; }
                  else if (iconKey !== 'default') { iconFileKey = `exp_${originalSpeaker}_${iconKey}`; }
                  else { iconFileKey = charSettingFull.isNew ? `newchar_${originalSpeaker}` : originalSpeaker; }

                  if (iconFileKey && uploadedFiles[iconFileKey] instanceof Blob) { const file = uploadedFiles[iconFileKey]; iconRelativePath = getImagePathForKey(iconFileKey, file); hasIconFile = !!iconRelativePath; }

                  if (!hasIconFile) {
                      const messageDataFromFullLog = displayLogData.find(d => d.id === messageId);
                      if (iconKey === 'override' && messageDataFromFullLog?.overrideIconSrc) iconRelativePath = messageDataFromFullLog.overrideIconSrc;
                      else if (iconKey !== 'default' && charSettingFull.expressions?.[iconKey]) iconRelativePath = charSettingFull.expressions[iconKey];
                      else if (charSettingFull.icon) iconRelativePath = charSettingFull.icon;
                      else iconRelativePath = '';
                  }

                  const charThemeColor = charSettingFull.color || item.color || '#000000';
                  const iconBorderColor = charThemeColor;
                  const placeholderChar = escapeHtml(speakerName).charAt(0) || '?';

                  // アイコンHTML生成: 単体HTML→CSSクラスDIV方式、ZIP→IMGタグ方式
                  let iconElHtml;
                  let placeholderDisplay = !iconRelativePath ? 'inline-block' : 'none';
                  if (outputOptions.assetClassMap) {
                      // 単体HTML出力モード: CSS background-imageクラスを使用
                      const getOrCreateClass = (source) => {
                          if (!source) return null;
                          if (outputOptions.assetClassMap.has(source)) return outputOptions.assetClassMap.get(source);
                          const dataUrl = source.startsWith('data:') ? source : (outputOptions.imageDataUrlMap?.get(source) || null);
                          if (!dataUrl) return null;
                          const cls = `rr_asset_${outputOptions.assetClassMap.size}`;
                          outputOptions.assetClassMap.set(source, cls);
                          outputOptions.assetCssRules.push(`.${cls}{background-image:url(${dataUrl})}`);
                          return cls;
                      };
                      const assetClass = iconRelativePath ? getOrCreateClass(iconRelativePath) : null;
                      if (assetClass) {
                          iconElHtml = `<div class="icon export ${assetClass}" aria-label="${escapeHtml(speakerName)}" style="border-color: ${iconBorderColor};"></div>`;
                          placeholderDisplay = 'none';
                      } else {
                          iconElHtml = '';
                          placeholderDisplay = 'inline-block';
                      }
                  } else {
                      // ZIP出力モード: imgタグ
                      const imageDisplay = iconRelativePath ? 'block' : 'none';
                      const iconSrc = iconRelativePath ? escapeHtml(iconRelativePath) : '';
                      iconElHtml = `<img src="${iconSrc}" alt="${escapeHtml(speakerName)} (${iconKey})" class="icon export" style="border-color: ${iconBorderColor}; display: ${imageDisplay};" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">`;
                  }

                  const _customColors = currentCustomization.customBubbleColors || [];
                  const _getLightColor = (align) => {
                      const _m = align && align.match(/^(?:left|right)-custom-(\d+)$/);
                      if (_m) { const _c = _customColors[parseInt(_m[1])-1]; if (_c) return _c.light; }
                      return isRightAlignment(align) ? rightBubbleColor : normalBubbleColor;
                  };
                  const _exportBubbleColor = _getLightColor(finalAlignment);
                  const bubbleBgStyle = `--bubble-bg-color: ${_exportBubbleColor}; --bubble-arrow-color: ${_exportBubbleColor};`;
                  const _isRight = isRightAlignment(finalAlignment);

                  if (finalDisplayMode === 'narration') {
                      logBodyContent += `
<div class="message-item export log-item" data-tab="${escapeHtml(item.tab || 'main')}" data-speaker="${escapeHtml(originalSpeaker)}" data-display-mode="${finalDisplayMode}">
  <div class="narration-container export" style="${textStyle}">${parseMarkdownForExport(item.message)}</div>
</div>\n`;
                  } else {
                      logBodyContent += `
<div class="message-item export log-item" data-tab="${escapeHtml(item.tab || 'main')}" data-speaker="${escapeHtml(originalSpeaker)}" data-display-mode="${finalDisplayMode}">
  <div class="message-container export ${_isRight ? 'align-right' : ''}">
      <div class="icon-container export" style="width:${iconSize}px; height:${iconSize}px;">
          ${iconElHtml}
          <span class="icon-placeholder export" style="display: ${placeholderDisplay}; border-color: ${iconBorderColor}; line-height: ${Math.round(iconSize*0.9)}px; font-size: ${Math.round(iconSize*0.5)}px;">${placeholderChar}</span>
      </div>
      <div class="content-container export">
          <span class="speaker-name-default export" style="${textStyle}">${escapeHtml(speakerName)} <span class="original-tab export">[${escapeHtml(item.tab || 'main')}]</span></span>
          <div class="bubble export ${_isRight ? 'bubble-right' : 'bubble-left'}" data-bubble-align="${finalAlignment}" style="${bubbleBgStyle} ${textStyle}">${parseMarkdownForExport(item.message)}</div>
      </div>
  </div>
</div>\n`;
                  }
              } else if (item.type === 'image') {
                   let imageRelativePath = ''; const imageId = item.id;
                   const isHeader = item.anchorId === HEADER_IMAGE_ANCHOR;
                   let dataTab = 'header', dataSpeaker = 'header_img';
                   if(!isHeader) { const anchorMsg = displayLogData.find(m => m.id === item.anchorId && m.type==='message'); if(anchorMsg) { dataTab = anchorMsg.tab || 'main'; dataSpeaker = anchorMsg.speaker || '不明'; } else { dataTab = 'main'; dataSpeaker = '不明';}}
                   if (!isHeader && tabSettingsData?.[dataTab]?.hidden) return;

                   if (uploadedFiles[imageId] instanceof Blob) { const file = uploadedFiles[imageId]; imageRelativePath = getImagePathForKey(imageId, file); }
                   else {
                       const imgDataFromFullLog = displayLogData.find(d => d.id === imageId); imageRelativePath = imgDataFromFullLog?.src || '';
                   }
                   const imageAlt = item.caption ? escapeHtml(item.caption) : `挿入画像 ${imageId}`;
                   // 挿入画像: 単体HTML→data URL直接埋め込み、ZIP→相対パス
                   let insertedSrc = '';
                   if (imageRelativePath) {
                       if (outputOptions.imageDataUrlMap) {
                           // 単体HTML: data URLを直接埋め込む
                           insertedSrc = outputOptions.imageDataUrlMap.get(imageRelativePath)
                               || (imageRelativePath.startsWith('data:') ? imageRelativePath : '');
                       } else {
                           // ZIP: 相対パスをそのまま（テンプレート側でescapeHtml）
                           insertedSrc = imageRelativePath;
                       }
                   }
                   logBodyContent += `
<div class="inserted-image-container export log-item" data-tab="${escapeHtml(dataTab)}" data-speaker="${escapeHtml(dataSpeaker)}">
  <img src="${insertedSrc ? escapeHtml(insertedSrc) : ''}" alt="${imageAlt}" class="inserted-image export" ${insertedSrc ? '' : 'style="display:none;"'} onerror="this.style.display='none'; const p=document.createElement('p'); p.className='image-error-placeholder export'; p.textContent='[画像 ${escapeHtml(imageId)} 読込失敗]'; this.parentNode.appendChild(p);">
  ${!imageRelativePath ? `<p class="image-error-placeholder export">[画像 ${escapeHtml(imageId)} ファイル不明]</p>` : ''}`;
                   if (item.caption) { logBodyContent += `\n    <p class="image-caption export">${escapeHtml(item.caption)}</p>`; } logBodyContent += `\n</div>\n`;
              } else if (item.type === 'heading') {
                  headingsForNavOutput.push({ id: item.id, text: item.text, level: item.level });
                  logBodyContent += `<div id="${item.id}" class="heading-item export level-${item.level} log-item" data-tab="all" data-speaker="all" style="color: ${baseTextColor};">${escapeHtml(item.text)}</div>\n`;
              } else if (item.type === 'error') { logBodyContent += `\n<div class="error-message export log-item" data-tab="all" data-speaker="all"><strong>解析エラー:</strong> ${escapeHtml(item.message)}<br><small>詳細: ${escapeHtml(item.details)}...</small></div>\n`; }
          } catch (htmlGenError) { console.error(`Error generating HTML for item ID ${item.id}:`, htmlGenError); logBodyContent += `<div class="export-error">アイテム(ID: ${item.id})のHTML生成エラー</div>\n`; }
      });
      const isZipOutput = !outputOptions.assetClassMap;

      let headingsNavHtml = '';
      if (headingsForNavOutput.length > 0) {
          if (isZipOutput) {
              const navLinks = headingsForNavOutput.map(h =>
                  `<a href="#${h.id}" class="nav-level-${h.level}">${escapeHtml(h.text)}</a>`
              ).join('\n');
              headingsNavHtml = `<div id="export-headings-nav-container" class="export-headings-nav"><button id="export-toggle-headings-nav" title="見出し一覧の表示/非表示">見出し</button><div class="nav-content"><h5>見出し</h5>${navLinks}</div></div>`;
          } else {
              const navLinks = headingsForNavOutput.map(h =>
                  `      <a href="#${h.id}" class="nav-level-${h.level}">${escapeHtml(h.text)}</a>`
              ).join('\n');
              headingsNavHtml = `<input type="checkbox" id="export-nav-toggle" class="export-nav-toggle">
<label for="export-nav-toggle" class="export-nav-hamburger">&#9776;</label>
<div class="export-nav-overlay">
  <label for="export-nav-toggle" class="export-nav-close">&#10005; 閉じる</label>
  <nav class="export-nav-content">
${navLinks}
  </nav>
</div>`;
          }
      }
      const filterControlsHtml = isZipOutput ? `
<div class="filter-controls export">
  <div class="filter-group"> <label for="export-tab-filter">タブ:</label> <nav id="export-log-tabs" class="tab-nav export" aria-label="Log Tabs"><span class="placeholder">読み込み中...</span></nav> </div>
  <div id="export-all-mode-filter" class="all-mode-filter export hidden"></div>
  <div class="filter-group"> <label for="export-speaker-filter">発言者:</label> <select id="export-speaker-filter" class="speaker-filter export"><option value="all">すべての発言者</option></select> </div>
</div>` : '';
      const themeToggleBtnHtml = isZipOutput ? `<div class="export-theme-toggle-wrap"><button id="export-theme-btn" onclick="toggleExportTheme()">🌙</button></div>` : '';
      const safeHtmlTitle = escapeHtml(htmlTitle); const fontBodyClass = fontFamily || 'font-noto-sans';
      const finalEmbeddedJsContent = generateEmbeddedJsForExport(speakerDataForExport, baseTextColor, textEdgeColor, customizationSettings, isZipOutput);

      const bodyClasses = [fontBodyClass, 'export-body', 'rr-site-light'];
      if (customizationSettings.backgroundImage && customizationSettings.backgroundImageFileName) {
          bodyClasses.push('has-background-image');
      }

      return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${safeHtmlTitle}</title><link rel="stylesheet" href="style.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700&display=swap" rel="stylesheet"></head>
<body class="${bodyClasses.join(' ')}">${themeToggleBtnHtml}${headingsNavHtml}<div class="log-export-container"><h1>${safeHtmlTitle}</h1>${filterControlsHtml}<div id="export-log-display" class="log-display export">${logBodyContent || '<p class="empty-log-message export">ログデータがありません。</p>'}</div></div><script>${finalEmbeddedJsContent}<\/script></body></html>`;
  }
  function generateEmbeddedJsForExport(speakerDataForExport, baseTextColor, textEdgeColor, customSettings, isZipOutput) {
       const speakerMapString = JSON.stringify(speakerDataForExport || {});
       const baseTextColorString = JSON.stringify(baseTextColor || '#333333');
       const textEdgeColorString = JSON.stringify(textEdgeColor || '#ffffff');
       const s = customSettings || {};
       const exportThemeColorsString = isZipOutput ? JSON.stringify({
         lightNormal: s.normalBubbleColor || '#ffffff',
         darkNormal:  s.darkNormalBubbleColor || '#2d2d2d',
         lightRight:  s.rightBubbleColor || '#dcf8c6',
         darkRight:   s.darkRightBubbleColor || '#29342f',
         lightBg:     s.backgroundColor || '#f3f4f6',
         darkBg:      s.darkBgColor || 'rgba(0,0,0,0.30)',
         lightText:   s.baseTextColor || '#333333',
         darkText:    s.darkBaseTextColor || '#e8e8e8',
         lightEdge:   s.textEdgeColor || '#ffffff',
         darkEdge:    s.darkTextEdgeColor || 'transparent',
         customColors: s.customBubbleColors || []
       }) : 'null';

       return `
(function() { "use strict";
// iframe内かどうかを判定して背景透過を切り替える
if (window.self !== window.top) { document.body.classList.add('rr-in-iframe'); }
let currentExportTab = 'all'; let currentExportSpeaker = 'all'; let visibleTabsInAllModeExport = new Set();
const speakerSettings = ${speakerMapString}; const exportBaseTextColor = ${baseTextColorString}; const exportTextEdgeColor = ${textEdgeColorString};
${isZipOutput ? `const exportThemeColors = ${exportThemeColorsString};
let currentExportTheme = 'light';
// toggleExportTheme は function 宣言のためホイストされる。early return より前に window へ公開
window.toggleExportTheme = function() {
  currentExportTheme = currentExportTheme === 'light' ? 'dark' : 'light';
  applyExportTheme(currentExportTheme);
  var btn = document.getElementById('export-theme-btn');
  if (btn) btn.textContent = currentExportTheme === 'dark' ? '\u2600' : '\uD83C\uDF19';
};` : ''}
const exportLogTabsNav = document.getElementById('export-log-tabs'); const exportSpeakerFilter = document.getElementById('export-speaker-filter');
const exportAllModeFilter = document.getElementById('export-all-mode-filter'); const exportLogDisplay = document.getElementById('export-log-display');
const allLogItems = exportLogDisplay ? Array.from(exportLogDisplay.querySelectorAll('.log-item')) : [];
if (!exportLogDisplay) { console.error("Export log display not found."); return; }

document.documentElement.style.setProperty('--text-edge-color', exportTextEdgeColor);

function getSpeakerTextColor(speakerId) { return (speakerSettings[speakerId] && speakerSettings[speakerId].customTextColor) ? speakerSettings[speakerId].customTextColor : exportBaseTextColor; }
function applyInitialStyles() {
    allLogItems.forEach(item => {
        const speakerId = item.dataset.speaker;
        const speakerSetting = speakerSettings[speakerId];
        if (item.classList.contains('message-item')) {
            const textColor = getSpeakerTextColor(speakerId);
            const nameElements = item.querySelectorAll('.speaker-name-default');
            nameElements.forEach(el => el.style.color = textColor);
            const bubbleElement = item.querySelector('.bubble.export');
            if (bubbleElement) bubbleElement.style.color = textColor;
            const narrationContainer = item.querySelector('.narration-container.export');
            if (narrationContainer) narrationContainer.style.color = textColor;
        } else if (item.classList.contains('heading-item')) {
            item.style.color = exportBaseTextColor;
        }
    });
}

${isZipOutput ? `
(function() {
  var navContainer = document.getElementById('export-headings-nav-container');
  var navToggleBtn = document.getElementById('export-toggle-headings-nav');
  if (navContainer && navToggleBtn) {
    navToggleBtn.addEventListener('click', function() { navContainer.classList.toggle('open'); });
    navContainer.querySelectorAll('.nav-content a').forEach(function(a) {
      a.addEventListener('click', function() { navContainer.classList.remove('open'); });
    });
  }
})();` : ''}

function initializeExportFilters() {
    const uniqueTabs = new Set(['all']); const uniqueSpeakers = new Set(['all']); const speakerCounts = {};
    allLogItems.forEach(item => {
        const tab = item.dataset.tab; const speaker = item.dataset.speaker;
        if (tab && tab !== 'all' && tab !== 'header') uniqueTabs.add(tab);
        if (speaker && speaker !== 'all' && speaker !== '不明' && speaker !== 'header_img') {
             uniqueSpeakers.add(speaker); if(item.classList.contains('message-item')) speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
        }
    });
    visibleTabsInAllModeExport = new Set([...uniqueTabs].filter(t => t !== 'all'));
    if(exportLogTabsNav) populateExportTabs(uniqueTabs);
    if(exportSpeakerFilter) {populateExportSpeakerFilter(uniqueSpeakers, speakerCounts); exportSpeakerFilter.addEventListener('change', handleExportSpeakerChange);}
    if(exportAllModeFilter) populateExportAllModeFilter(uniqueTabs);
    handleExportTabChange(currentExportTab);
    applyExportFilters();
}

function populateExportTabs(tabsSet) {
    exportLogTabsNav.innerHTML = '';
    const sortedTabs = [...tabsSet].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b));
    const fragment = document.createDocumentFragment(); sortedTabs.forEach(tab => {
        const button = document.createElement('button'); button.textContent = '[' + tab + ']'; button.dataset.tab = tab;
        button.className = 'tab-button export'; if (tab === currentExportTab) button.classList.add('active');
        button.addEventListener('click', () => handleExportTabChange(tab)); fragment.appendChild(button);
    });
    exportLogTabsNav.appendChild(fragment);
}

function populateExportAllModeFilter(tabsSet) {
    exportAllModeFilter.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'all-mode-checkbox-container';
    const tabsToDisplay = [...tabsSet].filter(t => t !== 'all').sort();
    if (tabsToDisplay.length === 0) return;
    tabsToDisplay.forEach(tab => {
        const wrapper = document.createElement('div'); wrapper.className = 'checkbox-wrapper';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = 'export-check-' + tab; checkbox.value = tab;
        checkbox.checked = visibleTabsInAllModeExport.has(tab);
        checkbox.addEventListener('change', (e) => { if (e.target.checked) visibleTabsInAllModeExport.add(tab); else visibleTabsInAllModeExport.delete(tab); applyExportFilters(); });
        const label = document.createElement('label'); label.htmlFor = 'export-check-' + tab; label.textContent = tab;
        wrapper.appendChild(checkbox); wrapper.appendChild(label); container.appendChild(wrapper);
    });
    const btns = document.createElement('div'); btns.className = 'all-mode-buttons';
    const selectAll = document.createElement('button'); selectAll.textContent = '全選択';
    selectAll.onclick = () => { tabsToDisplay.forEach(t => visibleTabsInAllModeExport.add(t)); populateExportAllModeFilter(tabsSet); applyExportFilters(); };
    const deselectAll = document.createElement('button'); deselectAll.textContent = '全解除';
    deselectAll.onclick = () => { visibleTabsInAllModeExport.clear(); populateExportAllModeFilter(tabsSet); applyExportFilters(); };
    btns.appendChild(selectAll); btns.appendChild(deselectAll); container.appendChild(btns);
    exportAllModeFilter.appendChild(container);
}

function populateExportSpeakerFilter(speakersSet, counts) {
    const sortedSpeakers = [...speakersSet].sort((a, b) => { if (a === 'all') return -1; if (b === 'all') return 1; const countDiff = (counts[b] || 0) - (counts[a] || 0); return countDiff !== 0 ? countDiff : a.localeCompare(b); });
    const fragment = document.createDocumentFragment(); if (!sortedSpeakers.includes('all')) sortedSpeakers.unshift('all');
    sortedSpeakers.forEach(speaker => {
        const option = document.createElement('option'); option.value = speaker;
        if (speaker === 'all') { option.textContent = 'すべての発言者'; } else { const displayName = (speakerSettings[speaker] && speakerSettings[speaker].displayName) ? speakerSettings[speaker].displayName : speaker; const count = counts[speaker] || 0; option.textContent = displayName + ' (' + count + '回)'; }
        fragment.appendChild(option);
    });
    exportSpeakerFilter.innerHTML = ''; exportSpeakerFilter.appendChild(fragment); exportSpeakerFilter.value = currentExportSpeaker; exportSpeakerFilter.disabled = sortedSpeakers.length <= 1;
}

function handleExportTabChange(tabName) {
    if (currentExportTab === tabName) return; currentExportTab = tabName;
    if(exportLogTabsNav) exportLogTabsNav.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    if(exportAllModeFilter) exportAllModeFilter.classList.toggle('hidden', tabName !== 'all');
    applyExportFilters();
}

function handleExportSpeakerChange() { const newSpeaker = exportSpeakerFilter.value; if (currentExportSpeaker === newSpeaker) return; currentExportSpeaker = newSpeaker; applyExportFilters(); }

function applyExportFilters() {
    let visibleCount = 0;
    allLogItems.forEach(item => {
        const itemTab = item.dataset.tab; const itemSpeaker = item.dataset.speaker;
        let isVisible = false;

        const speakerMatch = currentExportSpeaker === 'all' || itemSpeaker === currentExportSpeaker;

        let tabMatch = false;
        if (item.classList.contains('heading-item') || item.classList.contains('error-message')) {
            tabMatch = true;
        } else if (currentExportTab === 'all') {
            if (itemTab === 'header') {
                tabMatch = true;
            } else {
                tabMatch = itemTab ? visibleTabsInAllModeExport.has(itemTab) : false;
            }
        } else {
            tabMatch = itemTab === currentExportTab;
        }

        isVisible = speakerMatch && tabMatch;

        if (isVisible) { item.classList.remove('hidden-log-item'); visibleCount++; }
        else { item.classList.add('hidden-log-item'); }
    });
    updateExportTabSeparators();
}

function updateExportTabSeparators() {
    // Rebuild separators every time to avoid "ghost" separators after filtering / deletions.
    exportLogDisplay.querySelectorAll('.tab-separator.export').forEach(hr => hr.remove());

    if (currentExportTab !== 'all') return;

    const visibleMessages = Array.from(exportLogDisplay.querySelectorAll('.message-item.export.log-item'))
        .filter(el => !el.classList.contains('hidden-log-item') && el.dataset.tab !== 'header');

    let prevTab = null;
    visibleMessages.forEach((el, idx) => {
        const tab = el.dataset.tab || 'main';
        if (idx > 0 && prevTab !== null && tab !== prevTab) {
            const hr = document.createElement('hr');
            hr.className = 'tab-separator export';
            el.parentNode.insertBefore(hr, el);
        }
        prevTab = tab;
    });
}

${isZipOutput ? `
function getExportBubbleColor(align, isDark, c) {
  var m = align && align.match(/^(left|right)-custom-(\d+)$/);
  if (m) {
    var idx = parseInt(m[2]) - 1;
    var custom = c.customColors && c.customColors[idx];
    if (custom) return isDark ? custom.dark : custom.light;
    return m[1] === 'right' ? (isDark ? c.darkRight : c.lightRight) : (isDark ? c.darkNormal : c.lightNormal);
  }
  var isRight = align === 'right' || (align && align.startsWith('right-custom-'));
  return isDark ? (isRight ? c.darkRight : c.darkNormal) : (isRight ? c.lightRight : c.lightNormal);
}
function applyExportTheme(theme) {
  var isDark = theme === 'dark';
  var c = exportThemeColors;
  document.body.classList.remove('rr-site-dark','rr-site-light');
  document.body.classList.add('rr-site-' + theme);
  if (exportLogDisplay) {
    exportLogDisplay.style.backgroundColor = isDark ? c.darkBg : c.lightBg;
    exportLogDisplay.style.color = isDark ? c.darkText : c.lightText;
    document.documentElement.style.setProperty('--text-edge-color', isDark ? c.darkEdge : c.lightEdge);
    document.documentElement.style.setProperty('--bubble-right-bg-color', isDark ? c.darkRight : c.lightRight);
    document.documentElement.style.setProperty('--bubble-right-arrow-color', isDark ? c.darkRight : c.lightRight);
    exportLogDisplay.querySelectorAll('.bubble.export').forEach(function(b) {
      var align = b.dataset.bubbleAlign || (b.classList.contains('bubble-right') ? 'right' : 'left');
      var col = getExportBubbleColor(align, isDark, c);
      b.style.setProperty('--bubble-bg-color', col);
      b.style.setProperty('--bubble-arrow-color', col);
    });
    exportLogDisplay.querySelectorAll('.message-item.log-item').forEach(function(item) {
      var sp = item.dataset.speaker;
      var custom = (speakerSettings[sp] && speakerSettings[sp].customTextColor) ? speakerSettings[sp].customTextColor : null;
      var tc = custom || (isDark ? c.darkText : c.lightText);
      item.querySelectorAll('.speaker-name-default,.bubble.export,.narration-container.export')
        .forEach(function(el) { el.style.color = tc; });
    });
  }
}

window.addEventListener('message', function(e) {
  if (e.data && (e.data.theme === 'dark' || e.data.theme === 'light')) {
    currentExportTheme = e.data.theme;
    applyExportTheme(e.data.theme);
  }
});` : ''}

;
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => { applyInitialStyles(); initializeExportFilters(); }); }
else { applyInitialStyles(); initializeExportFilters(); }
})();`;
   }

  function generateMinifiedCss(css) {
    let minified = css;
    minified = minified.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    minified = minified.replace(/[\n\t\r]/g, '');
    minified = minified.replace(/\s\s+/g, ' ');
    minified = minified.replace(/\s*([{};:,])\s*/g, '$1');
    minified = minified.trim();
    minified = minified.replace(/;}/g, '}');
    minified = minified.replace(/\s*!important/g, '!important');
    return minified;
  }

  function generateOutputCss(currentCustomization, options = {}) {
      const { iconSize, bubbleMaxWidth, normalBubbleColor, backgroundColor, fontSize, fontFamily, baseTextColor, rightBubbleColor, textEdgeColor, backgroundImage, backgroundImageFileName } = currentCustomization;
      const placeholderLineHeight = Math.round(iconSize * 0.9); const placeholderFontSize = Math.round(iconSize * 0.5);
      const responsiveIconSize = Math.max(24, Math.round(iconSize * 0.75)); const responsivePlaceholderLineHeight = Math.round(responsiveIconSize * 0.9); const responsivePlaceholderFontSize = Math.round(responsiveIconSize * 0.5);
      const fontFamilies = { 'font-inter': "'Inter', sans-serif", 'font-noto-sans': "'Noto Sans JP', sans-serif", 'font-noto-serif': "'Noto Serif JP', serif", 'font-mplus-rounded': "'M PLUS Rounded 1c', sans-serif", 'font-system-sans': "sans-serif", 'font-system-serif': "serif", 'font-system-mono': "monospace" };
      const selectedFontFamily = fontFamilies[fontFamily] || fontFamilies['font-noto-sans'];
      const isSingleFileHtml = !!options.isSingleFileHtml;
      const darkPageBackground = options.darkPageBackground || HTML_EXPORT_DARK_SOLID_BG;

      let backgroundImageExportPath = '';
      if (backgroundImage && backgroundImageFileName && uploadedFiles[BACKGROUND_IMAGE_KEY]) {
          backgroundImageExportPath = getImagePathForKey(BACKGROUND_IMAGE_KEY, uploadedFiles[BACKGROUND_IMAGE_KEY]);
      } else if (backgroundImage) {
          backgroundImageExportPath = backgroundImage;
      }


      const logContainerBg = (backgroundImage && backgroundImageExportPath) ? 'rgba(255, 255, 255, 0.85)' : (currentCustomization.backgroundColor || '#f3f4f6');


       return `
/* Exported Log Styles */
:root {
    --bubble-max-width: ${bubbleMaxWidth}%;
    --bubble-bg-color: ${normalBubbleColor};
    --bubble-arrow-color: ${normalBubbleColor};
    --bubble-right-bg-color: ${rightBubbleColor};
    --bubble-right-arrow-color: ${rightBubbleColor};
    --icon-size: ${iconSize}px;
    --base-text-color: ${baseTextColor};
    --text-edge-color: ${textEdgeColor};
}
body.export-body {
    font-family: ${selectedFontFamily};
    margin: 0;
    padding: 0;
    background-color: ${backgroundColor};
    font-size: ${fontSize}px;
    line-height: 1.7;
    color: var(--base-text-color);
    position: relative;
    transition: margin-left 0.3s ease-in-out;
}
body.export-body.has-background-image::before {
    content: "";
    position: fixed;
    left: 0; right: 0; top: 0; bottom: 0;
    z-index: -1;
    background-image: url('${backgroundImageExportPath}');
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    filter: blur(8px) brightness(1.1);
}
.log-export-container {
    max-width: 900px;
    margin: 20px auto;
    padding: 20px 25px;
    background-color: ${logContainerBg};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 1;
}
h1 {
    font-size: 1.7em;
    border-bottom: 2px solid #eee;
    padding-bottom: 10px;
    margin: 0 0 25px 0;
    text-align: center;
color: var(--base-text-color);
}
.log-display.export { margin-top: 10px; }
.hidden-log-item { display: none !important; }
.log-item { margin-bottom: 16px; }
.message-item.export { position: relative; }
.message-container.export { display: flex; align-items: flex-start; }
.narration-container.export { padding: 2px 4px 2px calc(var(--icon-size) + 12px); line-height: inherit; }

.message-container.export.align-right { flex-direction: row-reverse; }
.message-container.export.align-right .icon-container.export { margin-left: 12px; margin-right: 0; }
.message-container.export.align-right .content-container.export { text-align: right; }
.message-container.export.align-right .speaker-name-default.export { text-align: right; }
.bubble.export.bubble-right {
    margin-left: auto; margin-right: 0;
}
.bubble.export.bubble-right::before {
    content: ""; position: absolute; top: 10px; width: 0; height: 0; border-style: solid;
    left: auto; right: -8px; border-width: 8px 0 8px 10px;
    border-color: transparent transparent transparent var(--bubble-arrow-color);
}
.icon-container.export {
    flex-shrink: 0; margin-right: 12px;
    width: var(--icon-size); height: var(--icon-size);
    position: relative; border-radius: 50%;
}
.icon.export {
    display: block; width: 100%; height: 100%; border-radius: 50%;
    border: 3px solid;
    box-sizing: border-box; background-color: #f0f0f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
img.icon.export { object-fit: cover; object-position: 50% 0%; }
div.icon.export { background-size: cover; background-position: 50% 0%; background-repeat: no-repeat; }
.icon-placeholder.export {
    display: none; width: 100%; height: 100%; border-radius: 50%;
    border: 3px solid;
    box-sizing: border-box; background-color: #e0e0e0; color: #757575;
    font-weight: bold; text-align: center; overflow: hidden; text-transform: uppercase;
    line-height: ${placeholderLineHeight}px; font-size: ${placeholderFontSize}px;
}
.content-container.export { flex-grow: 1; min-width: 0; }
.speaker-name-default.export, .narration-speaker {
    text-shadow: -1px -1px 0 var(--text-edge-color), 1px -1px 0 var(--text-edge-color), -1px 1px 0 var(--text-edge-color), 1px 1px 0 var(--text-edge-color);
}
.speaker-name-default.export { display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.9em; }
.original-tab.export { font-weight: normal; font-size: 0.88em; color: #555; margin-left: 6px; text-shadow: -1px -1px 0 var(--text-edge-color), 1px -1px 0 var(--text-edge-color), -1px 1px 0 var(--text-edge-color), 1px 1px 0 var(--text-edge-color); }
.bubble.export {
    position: relative; padding: 10px 15px; border-radius: 16px;
    word-wrap: break-word; word-break: break-word;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    background-color: var(--bubble-bg-color);
    max-width: var(--bubble-max-width);
    text-align: left;
}
.bubble.export.bubble-left::before {
    content: ""; position: absolute; top: 10px; left: -8px;
    width: 0; height: 0; border-style: solid;
    border-width: 8px 10px 8px 0;
    border-color: transparent var(--bubble-arrow-color) transparent transparent;
}
.bubble.export a { color: #0066cc; text-decoration: underline; }
.bubble.export a:hover { color: #004c99; text-decoration: none; }
.narration-tab { font-size: 0.8em; color: #666; margin-right: 0.5em; text-shadow: -1px -1px 0 var(--text-edge-color), 1px -1px 0 var(--text-edge-color), -1px 1px 0 var(--text-edge-color), 1px 1px 0 var(--text-edge-color); }
.narration-speaker { font-weight: bold; margin-right: 0.25em; }
.narration-message { display: inline; }
.inserted-image-container.export { text-align: center; }
.inserted-image.export { max-width: 85%; max-height: 550px; border-radius: 6px; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15); display: block; margin: 0 auto; }
.image-caption.export { font-size: 0.9em; color: #444; margin-top: 6px; padding: 0 5%; line-height: 1.4; text-shadow: -1px -1px 0 var(--text-edge-color), 1px -1px 0 var(--text-edge-color), -1px 1px 0 var(--text-edge-color), 1px 1px 0 var(--text-edge-color); }
.image-error-placeholder.export { color: #d9534f; font-size: 0.9em; font-weight: bold; margin-top: 8px; padding: 5px; background-color: #f2dede; border: 1px solid #ebccd1; border-radius: 4px; display: inline-block; }
.tab-separator.export { border: 0; border-top: 2px dashed #cccccc; margin: 25px 5%; display: block; }
.error-message.export { background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 10px 15px; border-radius: 4px; margin: 15px 0; font-size: 0.9em; }
.empty-log-message.export { text-align: center; color: #666; font-style: italic; padding: 30px; }
.export-error { color: red; font-weight: bold; text-align: center; margin: 10px; padding: 5px; border: 1px solid red; background-color: #ffeeee; }
.heading-item.export { margin: 12px 0 8px 0; padding: 5px 0; font-weight: bold; scroll-margin-top: 10px; }
.heading-item.export.level-1 { font-size: 1.4em; border-bottom: 2px solid #3498db; margin-top: 20px; padding-bottom: 8px;}
.heading-item.export.level-2 { font-size: 1.2em; border-bottom: 1px solid #95a5a6; margin-top: 15px; padding-bottom: 6px;}
.heading-item.export.level-3 { font-size: 1.05em; margin-top: 10px; padding-bottom: 4px;}
.heading-item.export.level-4 { font-size: 1.0em; margin-top: 8px; padding-bottom: 3px; color: #555; }
.heading-item.export.level-5 { font-size: 0.95em; margin-top: 6px; padding-bottom: 2px; font-weight: normal; color: #666; }
.heading-item.export.level-6 { font-size: 0.9em; margin-top: 5px; padding-bottom: 1px; font-weight: normal; color: #777; }
${!isSingleFileHtml ? `
.export-headings-nav { position: fixed; left: -210px; top: 10px; width: 200px; height: calc(100vh - 20px); overflow: visible; background: #f9f9f9; border: 1px solid #ddd; border-left:none; border-radius: 0 5px 5px 0; z-index: 1000; font-size: 0.9em; transition: left 0.3s ease, box-shadow 0.3s ease; box-shadow: 2px 0 5px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
.export-headings-nav.open { left: 0px !important; box-shadow: 2px 0 10px rgba(0,0,0,0.2); }
.export-headings-nav button#export-toggle-headings-nav { position: absolute; left: 100%; top: 0; background: #3498db; color: white; border: none; padding: 10px 5px; border-radius: 0 4px 4px 0; cursor: pointer; font-size: 0.8em; writing-mode: vertical-rl; text-orientation: mixed; z-index:1; transition: background-color 0.2s; }
.export-headings-nav button#export-toggle-headings-nav:hover { background: #2980b9; }
.export-headings-nav .nav-content { padding: 8px 10px; overflow-y: auto; flex-grow: 1; }
.export-headings-nav .nav-content h5 { margin: 0 0 6px 0; font-size: 0.95em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
.export-headings-nav .nav-content a { text-decoration: none; color: #337ab7; padding: 4px 0; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-radius: 2px; font-size: 0.92em; }
.export-headings-nav .nav-content a:hover { color: #23527c; background: #eee; }
.nav-level-1 { font-weight: bold; }
.nav-level-2 { padding-left: 10px !important; }
.nav-level-3 { padding-left: 20px !important; font-size: 0.95em; }
.nav-level-4 { padding-left: 30px !important; font-size: 0.9em; }
.nav-level-5 { padding-left: 40px !important; font-size: 0.85em; }
.nav-level-6 { padding-left: 50px !important; font-size: 0.85em; }` : `
.export-nav-toggle { position: absolute; opacity: 0; pointer-events: none; }
.export-nav-hamburger { position: fixed; top: 12px; left: 12px; z-index: 1001; background: #3498db; color: white; padding: 8px 11px; border-radius: 6px; cursor: pointer; font-size: 1.4em; line-height: 1; user-select: none; -webkit-user-select: none; box-shadow: 0 2px 8px rgba(0,0,0,0.30); }
.export-nav-overlay { display: none; position: fixed; inset: 0; z-index: 1000; background: rgba(10,10,10,0.93); overflow-y: auto; padding: 60px 24px 32px; box-sizing: border-box; }
.export-nav-toggle:checked ~ .export-nav-overlay { display: block; }
.export-nav-close { display: inline-block; position: absolute; top: 14px; right: 18px; color: white; font-size: 0.95em; cursor: pointer; padding: 6px 14px; border: 1px solid rgba(255,255,255,0.45); border-radius: 5px; user-select: none; -webkit-user-select: none; }
.export-nav-content { display: flex; flex-direction: column; max-width: 620px; margin: 0 auto; }
.export-nav-content a { color: rgba(255,255,255,0.88); text-decoration: none; padding: 11px 8px; border-bottom: 1px solid rgba(255,255,255,0.12); border-radius: 3px; font-size: 1em; -webkit-tap-highlight-color: transparent; }
.export-nav-content a:hover, .export-nav-content a:active { background: rgba(255,255,255,0.12); color: white; }
.nav-level-1 { font-weight: bold; font-size: 1.05em; }
.nav-level-2 { padding-left: 16px !important; }
.nav-level-3 { padding-left: 32px !important; font-size: 0.95em; }
.nav-level-4 { padding-left: 48px !important; font-size: 0.9em; }
.nav-level-5 { padding-left: 64px !important; font-size: 0.85em; color: rgba(255,255,255,0.68); }
.nav-level-6 { padding-left: 80px !important; font-size: 0.85em; color: rgba(255,255,255,0.55); }`}
@media (max-width: 768px) {
    body.export-body { padding: 0; font-size: ${Math.max(14, fontSize - 1)}px; margin-left: 0 !important; }
    .log-export-container { padding: 15px; margin: 10px; }
    h1 { font-size: 1.5em; margin-bottom: 20px; }
    .filter-controls.export { flex-direction: column; align-items: stretch; }
    .filter-group { flex-direction: column; align-items: flex-start; width: 100%; }
    .tab-nav.export { justify-content: center; }
    .speaker-filter.export { width: 100%; }
    .icon-container.export { width: ${responsiveIconSize}px; height: ${responsiveIconSize}px; margin-right: 10px; }
    .narration-container.export { padding-left: calc(${responsiveIconSize}px + 10px); }
    .icon-placeholder.export { line-height: ${responsivePlaceholderLineHeight}px; font-size: ${responsivePlaceholderFontSize}px; }
    .bubble.export { padding: 8px 12px; }
    .bubble.export.bubble-left::before { top: 8px; left: -7px; border-width: 7px 9px 7px 0;}
    .bubble.export.bubble-right::before { top: 8px; right: -7px; left: auto; border-width: 7px 0 7px 9px;}
    .speaker-name-default.export { font-size: 0.92em; }
    .original-tab.export { font-size: 0.82em; }
    .inserted-image.export { max-width: 95%; max-height: 400px; }
    .image-caption.export { font-size: 0.85em; padding: 0 2%; }
    .tab-separator.export { margin: 20px 3%; }
    ${!isSingleFileHtml ? `.export-headings-nav { width: 180px; left: -190px; }
    .export-headings-nav.open { left: 0px !important; }
    .export-headings-nav button#export-toggle-headings-nav { padding: 8px 4px; }` : `.export-nav-hamburger { top: 10px; left: 10px; padding: 7px 10px; font-size: 1.3em; }`}
}
body.rr-site-light.export-body { background-color: ${backgroundColor} !important; color: rgba(20,14,8,0.90); }
${!isSingleFileHtml ? `
.filter-controls.export {
    background-color: #f8f9fa;
    padding: 10px 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    border: 1px solid #dee2e6;
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: flex-start;
}
.filter-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filter-group label { font-weight: bold; font-size: 0.9em; color: #495057; white-space: nowrap; }
.tab-nav.export { display: flex; flex-wrap: wrap; gap: 5px; }
.tab-button.export {
    background-color: #e9ecef; border: 1px solid #ced4da; color: #495057;
    padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85em;
    transition: background-color 0.2s, color 0.2s; white-space: nowrap;
}
.tab-button.export:hover { background-color: #dee2e6; }
.tab-button.export.active { background-color: #0d6efd; border-color: #0d6efd; color: white; font-weight: bold; }
.all-mode-filter.export {
    width: 100%;
    padding-top: 10px;
    border-top: 1px solid #e0e0e0;
    margin-top: 10px;
}
.all-mode-filter.export.hidden { display: none; }
.all-mode-checkbox-container { display: flex; flex-wrap: wrap; align-items: center; gap: 15px; }
.all-mode-filter.export .checkbox-wrapper { display: flex; align-items: center; }
.all-mode-filter.export input[type="checkbox"] { margin-right: 5px; cursor: pointer; }
.all-mode-filter.export label { font-size: 0.85em; cursor: pointer; }
.all-mode-buttons { margin-left: auto; display: flex; gap: 8px; }
.all-mode-buttons button { font-size: 0.75em; padding: 2px 6px; background: #ddd; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; }
.speaker-filter.export {
    padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px;
    font-size: 0.9em; background-color: white; min-width: 150px;
}
.tab-nav.export .placeholder { font-size: 0.85em; color: #6c757d; }
.export-theme-toggle-wrap { position: fixed; top: 10px; right: 10px; z-index: 9999; }
.export-theme-toggle-wrap button { padding: 5px 14px; border-radius: 20px; cursor: pointer; font-size: 0.82em; font-weight: bold; transition: background-color 0.3s ease, color 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
body.rr-site-light .export-theme-toggle-wrap button { background-color: #c94030; color: #fff; border: 2px solid #a03020; }
body.rr-site-dark .export-theme-toggle-wrap button { background-color: #FF7A5C; color: #1a1030; border: 2px solid #d95030; }
html:has(body.rr-site-dark.export-body:not(.rr-in-iframe):not(.has-background-image)) {
    background-image: url('img/bg.webp');
    background-size: cover;
    background-position: center bottom;
    background-repeat: no-repeat;
    background-attachment: fixed;
    background-color: #000;
}
@supports (-webkit-touch-callout: none) {
    html:has(body.rr-site-dark.export-body:not(.rr-in-iframe):not(.has-background-image)) {
        background-attachment: scroll;
    }
}
body.rr-site-dark.export-body { color: #e8e8e8; }
body.rr-site-dark.export-body.rr-in-iframe { background-color: transparent !important; }
body.rr-site-dark.export-body:not(.rr-in-iframe) { background-color: transparent !important; }
body.rr-site-dark.export-body:not(.rr-in-iframe)::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.28));
    z-index: -1;
}
body.rr-site-dark.export-body .log-export-container {
    background-color: rgba(0,0,0,0.52) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 4px 28px rgba(0,0,0,0.60);
}
/* ── ダーク：フィルタ / タブ / 見出しナビ ── */
body.rr-site-dark .filter-controls.export { background-color: rgba(0,0,0,0.42) !important; border-color: rgba(255,255,255,0.14) !important; }
body.rr-site-dark .filter-group label { color: rgba(232,232,232,0.80); }
body.rr-site-dark .speaker-filter.export { background-color: rgba(0,0,0,0.40) !important; border-color: rgba(255,255,255,0.18) !important; color: #e8e8e8 !important; }
body.rr-site-dark .tab-button.export { background-color: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.18) !important; color: #e8e8e8 !important; }
body.rr-site-dark .tab-button.export:hover { background-color: rgba(255,255,255,0.15) !important; }
body.rr-site-dark h1 { color: #FF7A5C !important; }
body.rr-site-dark .heading-item.export { color: #e8e8e8 !important; }
body.rr-site-dark .heading-item.export.level-1 { color: #FF7A5C !important; border-bottom-color: #FF7A5C !important; }
body.rr-site-dark .heading-item.export.level-2 { color: #8880E8 !important; border-bottom-color: rgba(136,128,232,0.45) !important; }
body.rr-site-dark .heading-item.export.level-3 { color: rgba(136,128,232,0.88) !important; }
body.rr-site-dark .heading-item.export.level-4 { color: rgba(136,128,232,0.80) !important; }
body.rr-site-dark .heading-item.export.level-5 { color: rgba(136,128,232,0.60) !important; }
body.rr-site-dark .heading-item.export.level-6 { color: rgba(136,128,232,0.44) !important; }
body.rr-site-dark .all-mode-buttons button { background: rgba(255,255,255,0.10) !important; border-color: rgba(255,255,255,0.18) !important; color: #e8e8e8 !important; }
body.rr-site-dark .export-headings-nav { background: rgba(0,0,0,0.72) !important; border-color: rgba(255,255,255,0.14) !important; }
body.rr-site-dark .export-headings-nav h5 { color: #e8e8e8 !important; border-bottom-color: rgba(255,255,255,0.14) !important; }
body.rr-site-dark .export-headings-nav .nav-content a { color: #b0aeee !important; }
body.rr-site-dark .export-headings-nav .nav-content a:hover { color: #cccaf8 !important; background: rgba(255,255,255,0.08) !important; }
body.rr-site-dark .export-headings-nav button#export-toggle-headings-nav { background: #FF7A5C !important; color: #1a1030 !important; }
` : ''}
`;
   }

  function handleWindowResize() {
      if (resizePerfRafId) {
          cancelAnimationFrame(resizePerfRafId);
      }
      resizePerfRafId = requestAnimationFrame(() => {
          document.body.classList.add('rr-resizing');
          resizePerfRafId = null;
      });
      if (resizePerfResetTimer) {
          clearTimeout(resizePerfResetTimer);
      }
      resizePerfResetTimer = setTimeout(() => {
          document.body.classList.remove('rr-resizing');
      }, 180);
  }

  function initializeApp() {
      // iframe内かどうかを判定（ダーク時の背景透過切り替えに使用）
      if (window.self !== window.top) {
          document.body.classList.add('rr-in-iframe');
      }
      document.body.classList.add('rr-site-light');
      currentTheme = 'light';
      // 表示カスタマイズはプロジェクトファイルのみで管理（localStorage不使用）
      try { localStorage.removeItem(LOCALSTORAGE_CUSTOMIZATION_KEY); } catch(_) {}
      resetCustomizationDefaults(); updateCustomizationUI();
      cocofoliaFileInput.addEventListener('change', handleCocofoliaFileSelect);
      if (udonariumFileInput) udonariumFileInput.addEventListener('change', handleUdonariumFileSelect);
      tekeyFileInput.addEventListener('change', handleTekeyFileSelect);
      projectLoadInput.addEventListener('change', handleProjectLoadFile);
      settingsTabButton.addEventListener('click', () => switchSettingsTab('tab'));
      characterTabButton.addEventListener('click', () => switchSettingsTab('character'));
      customizeTabButton.addEventListener('click', () => switchSettingsTab('customize'));
      resetCustomizationButton.addEventListener('click', resetCustomization);
      const addCustomBubbleColorBtn = document.getElementById('add-custom-bubble-color');
      if (addCustomBubbleColorBtn) addCustomBubbleColorBtn.addEventListener('click', addCustomBubbleColor);
      logTabsNav.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.dataset.tab) handleTabChange(e.target.dataset.tab); });
      speakerFilterSelect.addEventListener('change', handleSpeakerFilterChange);
      exportButton.addEventListener('click', handleExportZip);
      if (exportHtmlButton) exportHtmlButton.addEventListener('click', handleExportSingleHtml);
      saveProjectButton.addEventListener('click', saveProject);
      insertImageInput.addEventListener('change', handleInsertImageFile);
      bulkMoveButton.addEventListener('click', () => { if (bulkMoveMode) exitBulkMoveMode(); else enterBulkMoveMode(); });
      addNewCharacterButton.addEventListener('click', openAddNewCharacterModal);
      if (addNewTabButton) addNewTabButton.addEventListener('click', () => {
          const name = prompt('新規タブ名を入力してください:');
          if (!name || !name.trim()) return;
          const trimmed = name.trim();
          if (trimmed === 'all') { alert('「all」はシステム予約名のため使用できません。'); return; }
          if (uniqueTabsFound.has(trimmed)) { alert(`タブ「${trimmed}」はすでに存在します。`); return; }
          addNewTab(trimmed);
      });
      toggleHeadingsNavBtn.addEventListener('click', toggleHeadingsNav);
      genericModalCloseBtn.addEventListener('click', () => closeModal(genericModal));
      genericModalCancelBtn.addEventListener('click', () => closeModal(genericModal));
      window.addEventListener('click', (event) => { if (event.target === genericModal) closeModal(genericModal); });
      window.addEventListener('resize', handleWindowResize);

      fontSizeSlider.addEventListener('input', () => { fontSizeValueSpan.textContent = fontSizeSlider.value; });
      iconSizeSlider.addEventListener('input', () => { iconSizeValueSpan.textContent = iconSizeSlider.value; });
      bubbleWidthSlider.addEventListener('input', () => { bubbleWidthValueSpan.textContent = bubbleWidthSlider.value; });
      logHeightSlider.addEventListener('input', () => { logHeightValueSpan.textContent = logHeightSlider.value; });

      const sliderChangeApply = () => applyCustomization();
      fontSizeSlider.addEventListener('change', sliderChangeApply);
      iconSizeSlider.addEventListener('change', sliderChangeApply);
      bubbleWidthSlider.addEventListener('change', sliderChangeApply);
      logHeightSlider.addEventListener('change', () => {
          customizationSettings.logDisplayHeight = parseInt(logHeightSlider.value, 10);
          logDisplayDiv.style.height = `${customizationSettings.logDisplayHeight}px`;
      });

      fontFamilySelect.addEventListener('change', applyCustomization);
      normalColorInput.addEventListener('change', applyCustomization);
      rightBubbleColorInput.addEventListener('change', applyCustomization);
      backgroundColorInput.addEventListener('change', applyCustomization);
      skipDeleteConfirmToggle.addEventListener('change', applyCustomization);
      baseTextColorInput.addEventListener('change', applyCustomization);
      textEdgeColorInput.addEventListener('change', applyCustomization);
      backgroundImageInput.addEventListener('change', handleBackgroundImageUpload);
      clearBackgroundImageButton.addEventListener('click', clearBackgroundImage);
      if (darkNormalColorInput) darkNormalColorInput.addEventListener('change', applyCustomization);
      if (darkRightColorInput) darkRightColorInput.addEventListener('change', applyCustomization);
      if (darkBgColorInput) darkBgColorInput.addEventListener('change', applyCustomization);
      if (darkBaseTextColorInput) darkBaseTextColorInput.addEventListener('change', applyCustomization);
      if (darkTextEdgeColorInput) darkTextEdgeColorInput.addEventListener('change', applyCustomization);
      if (includeThemeToggleInput) includeThemeToggleInput.addEventListener('change', applyCustomization);
      if (speakerAlignmentModeToggle) speakerAlignmentModeToggle.addEventListener('change', applyCustomization);

      // カラースウォッチのリアルタイム更新
      ['dark-normal-bubble-color', 'dark-right-bubble-color', 'dark-bg-color', 'dark-text-edge-color'].forEach(id => {
          const el = document.getElementById(id);
          const sw = document.getElementById(id + '-swatch');
          if (el && sw) el.addEventListener('input', () => sw.style.setProperty('--swatch-color', el.value.trim() || 'transparent'));
      });
      refreshColorSwatches();

      switchSettingsTab('tab'); hideLoading(); disableControls(); updateHeadingsNav();
  }

  function switchSettingsTab(tabName) {
      const panels = [settingsPanel, characterPanel, customizePanel];
      const buttons = [settingsTabButton, characterTabButton, customizeTabButton];
      panels.forEach(panel => panel.classList.add('hidden'));
      buttons.forEach(button => { button.classList.remove('border-indigo-500', 'text-indigo-600'); button.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300'); button.removeAttribute('aria-current'); });
      let activePanel; let activeButton;
      if (tabName === 'tab') { activePanel = settingsPanel; activeButton = settingsTabButton; }
      else if (tabName === 'character') { activePanel = characterPanel; activeButton = characterTabButton; }
      else if (tabName === 'customize') { activePanel = customizePanel; activeButton = customizeTabButton; }
      if (activePanel) activePanel.classList.remove('hidden');
      if (activeButton) { activeButton.classList.add('border-indigo-500', 'text-indigo-600'); activeButton.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300'); activeButton.setAttribute('aria-current', 'page'); }
  }

  function applyTheme(theme) {
    document.body.classList.remove('rr-site-dark', 'rr-site-light');
    document.body.classList.add('rr-site-' + theme);
    currentTheme = theme;
    applyThemeAwareLogStyles();
    if (displayLogData.length > 0) renderLog();
  }

  function applyThemeAwareLogStyles() {
    if (!logDisplayDiv) return;
    const isDark = currentTheme === 'dark';

    // ログ背景
    logDisplayDiv.style.backgroundColor = isDark
      ? (customizationSettings.darkBgColor || 'rgba(0,0,0,0.30)')
      : customizationSettings.backgroundColor;

    // 吹き出し色
    const nc = isDark ? customizationSettings.darkNormalBubbleColor : customizationSettings.normalBubbleColor;
    logDisplayDiv.style.setProperty('--bubble-bg-color', nc);
    logDisplayDiv.style.setProperty('--bubble-arrow-color', nc);
    const rc = isDark ? customizationSettings.darkRightBubbleColor : customizationSettings.rightBubbleColor;
    logDisplayDiv.style.setProperty('--bubble-right-bg-color', rc);
    logDisplayDiv.style.setProperty('--bubble-right-arrow-color', rc);

    // テキスト色・縁取り色
    logDisplayDiv.style.color = isDark ? customizationSettings.darkBaseTextColor : customizationSettings.baseTextColor;
    logDisplayDiv.style.setProperty('--text-edge-color',
      isDark ? customizationSettings.darkTextEdgeColor : customizationSettings.textEdgeColor);
  }

  // グローバルブリッジ（postMessage受信用IIFE から呼び出す）
  window.__rrApplyTheme = applyTheme;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeApp); else initializeApp();

})();

 /* =====================================================
     サイト統合テーマ連携（postMessage受信）
     ===================================================== */
     
(function () {
    window.addEventListener('message', function (event) {
      if (event.data && (event.data.theme === 'dark' || event.data.theme === 'light')) {
        // applyTheme is defined inside the main IIFE; call via global bridge
        if (typeof window.__rrApplyTheme === 'function') window.__rrApplyTheme(event.data.theme);
      }
    });
  })();
