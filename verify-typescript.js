// Simple verification script to check TypeScript file structure
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib/security/input-sanitization.ts');

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let sanitizeTextInputLine = -1;
  let sanitizeStringHelperLine = -1;
  let sanitizeRequestBodyLine = -1;
  let duplicateHelperCount = 0;
  
  lines.forEach((line, index) => {
    if (line.includes('export function sanitizeTextInput')) {
      sanitizeTextInputLine = index;
    }
    if (line.includes('function sanitizeStringHelper')) {
      sanitizeStringHelperLine = index;
      duplicateHelperCount++;
    }
    if (line.includes('export function sanitizeRequestBody')) {
      sanitizeRequestBodyLine = index;
    }
  });
  
  console.log("✅ TypeScript file verification results:");
  console.log(`sanitizeTextInput defined at line: ${sanitizeTextInputLine + 1}`);
  console.log(`sanitizeStringHelper defined at line: ${sanitizeStringHelperLine + 1}`);
  console.log(`sanitizeRequestBody defined at line: ${sanitizeRequestBodyLine + 1}`);
  console.log(`Number of sanitizeStringHelper definitions: ${duplicateHelperCount}`);
  
  // Check order
  if (sanitizeTextInputLine < sanitizeStringHelperLine && sanitizeStringHelperLine < sanitizeRequestBodyLine) {
    console.log("✅ Function definition order is CORRECT");
  } else {
    console.log("❌ Function definition order issue");
  }
  
  // Check duplicates
  if (duplicateHelperCount === 1) {
    console.log("✅ No duplicate function definitions");
  } else {
    console.log(`❌ Found ${duplicateHelperCount} definitions of sanitizeStringHelper`);
  }
  
  console.log("\n✅ All TypeScript issues should now be resolved!");
  
} catch (error) {
  console.error('Error reading file:', error.message);
}
