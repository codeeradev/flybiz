var request = require('request');
var options = {
  'method': 'POST',
  'url': 'https://msggo.in/api/create-message',
  'headers': {
  },
  formData: {
    'appKey': '85c6089c-432b-48c5-8d6e-9c503d83c1a2',
    'authkey': 'YrmCnPjzHrjytYkePVujJzvAIKYk9QM3lxJKRerJ9XTOq0uQnx',
    'to': 'RECEIVER_NUMBER',
    'message': 'Example message'
  }
};
request(options, function (error, response) {
  if (error) throw new Error(error);
  console.log(response.body);
});
