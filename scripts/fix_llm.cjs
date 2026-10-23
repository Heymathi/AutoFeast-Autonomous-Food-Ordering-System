const fs = require('fs');
const fragment = fs.readFileSync('scripts/classify_code.txt', 'utf8');
let code = fs.readFileSync('src/services/llmNluService.ts', 'utf8');

const startIdx = code.indexOf('public static classifyLocationChoiceLocally(');
const endIdx = code.indexOf('public static async interpretLocationChoice(');

if (startIdx !== -1 && endIdx !== -1) {
  const commentIdx = code.lastIndexOf('/**', startIdx);
  code = code.slice(0, commentIdx) + fragment + '\n\n  ' + code.slice(endIdx);
  fs.writeFileSync('src/services/llmNluService.ts', code, 'utf8');
  console.log('Successfully replaced classifyLocationChoiceLocally from file!');
} else {
  console.error('Indices not found:', { startIdx, endIdx });
}
