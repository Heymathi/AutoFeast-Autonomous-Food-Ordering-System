import { parsePinSpeech } from './pinVoiceParserService';

function runTests() {
  console.log('Running parsePinSpeech Unit Tests...');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ PASSED: ${testName}`);
    } else {
      console.error(`  ✗ FAILED: ${testName}`);
    }
  }

  const languages = ['en', 'ta', 'hi'];

  languages.forEach((lang) => {
    // 1. Standard 1234 inputs in various formats across languages
    const inputs1234 = [
      'one two three four',
      '1 2 3 4',
      '1234',
      'onnu rendu moonu naalu',
      'ஒன்று இரண்டு மூன்று நான்கு',
      'ek do teen char',
      'एक दो तीन चार',
      '१२३४',
      '௧௨௩௪',
      'one rendu teen naalu',
      'ஒன் டூ த்ரீ போர்',
      'वन टू थ्री फोर',
      '1 rendu three char',
      'won to tree for'
    ];

    inputs1234.forEach((input, idx) => {
      const res = parsePinSpeech(input, lang);
      const isCorrect = res.status === 'success' && res.digits.join('') === '1234';
      assert(isCorrect, `[Lang: ${lang}] Input #${idx + 1} parses to 1234`);
    });
  });

  // 2. Reject 5 digits
  const fiveDigitsRes = parsePinSpeech('1 2 3 4 5');
  assert(fiveDigitsRes.status === 'too_many' && fiveDigitsRes.digits.length === 0, '5 digits rejected');

  // 3. Partial digits (3 digits)
  const threeDigitsRes = parsePinSpeech('1 2 3');
  assert(threeDigitsRes.status === 'need_more' && threeDigitsRes.digits.join('') === '123', '3 digits kept, status need_more');

  // 4. Invalid text
  const invalidRes = parsePinSpeech('xyz');
  assert(invalidRes.status === 'no_speech' && invalidRes.digits.length === 0, 'Invalid text returns no_speech');

  // 5. Unsupported "double" command
  const doubleRes = parsePinSpeech('double one two three');
  assert(doubleRes.status === 'requires_each_digit' && doubleRes.digits.length === 0, '"double" returns requires_each_digit');

  // 6. Voice commands
  const clearEn = parsePinSpeech('clear');
  assert(clearEn.status === 'command' && clearEn.command === 'clear', 'Command "clear" handled');

  const clearTa = parsePinSpeech('அழி');
  assert(clearTa.status === 'command' && clearTa.command === 'clear', 'Command "அழி" handled');

  const clearHi = parsePinSpeech('मिटाओ');
  assert(clearHi.status === 'command' && clearHi.command === 'clear', 'Command "मिटाओ" handled');

  const backTa = parsePinSpeech('பின்');
  assert(backTa.status === 'command' && backTa.command === 'back', 'Command "பின்" handled');

  const cancelHi = parsePinSpeech('रद्द');
  assert(cancelHi.status === 'command' && cancelHi.command === 'cancel', 'Command "रद्द" handled');

  console.log(`\nTest Execution Summary: ${passedCount}/${totalCount} tests passed.`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests();
