// 

const request = require('supertest')
const test = require('ava')
const expressSetup = require('./lib/_expressSetup')

const runTest = async (t, endpoint, expected) => {
  const { app, php } = expressSetup();
  const server = app.listen(0);  // Let the system pick an available port
  const port = server.address().port; // Get the assigned port number
  
  // php.enableRegisterGlobalModel(); // Reset to default state

  const res = await request(`http://localhost:${port}`).get(endpoint);
  console.log(`[DEBUG] Endpoint: ${endpoint}, Response: ${res.text}, Expected: ${expected}`);
  t.true(res.text.includes(expected));

  php.enableRegisterGlobalModel();
  server.close();
}


test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally', async t => {
  await runTest(t, '/disableRegisterGlobalModelGlobally', '<p></p><p>world</p>');
});

test('Passing a model variable down from Express to PHP and getting it to render as a registered global', async t => {
  await runTest(t, '/defaults', '<p>world</p>');
});

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled at the model level', async t => {
  await runTest(t, '/disableRegisterGlobalModelAtModelLevel', '<p></p><p>world</p>');
});

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally then reenabled', async t => {
  await runTest(t, '/disableRegisterGlobalModelGloballyThenReenabled', '<p>world</p><p>world</p>');
});

