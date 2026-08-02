const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  }
});

// Polyfill fetch if needed, Next.js actions might need it but Node 22 has it built-in.
async function testPost() {
    // import action
    const { postIncomeToJournal } = require('./.next/server/app/actions/accounting.js') || {};
    // wait, I can't just require nextjs actions easily from outside.
    // Let's just write a test script that replicates the lookup precisely.
}

testPost().catch(console.error);
