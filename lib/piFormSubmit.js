const dayjs = require('dayjs');
const { MAILGUN_API_KEY, MAILGUN_HOST, MAILGUN_SANDBOX_HOST } = process.env;
const timezone = process.env.TZ; // aws lambda reserved env variable

const mailgunHost =
  process.env.IS_OFFLINE === 'true' ? MAILGUN_SANDBOX_HOST : MAILGUN_HOST;
const mailgun = require('mailgun-js')({
  apiKey: MAILGUN_API_KEY,
  domain: mailgunHost,
});

let date = dayjs();
if (timezone === ':UTC') {
  date = date.subtract(5, 'hour'); // UTC offset -5 hours for EST
}

const sendEmail = async ({ playerName, parentPhone, parentEmail }) => {
  try {
    const message =
      'The following information was just submitted for a private instruction: \n\n' +
      'Date: ' +
      date.format('MM/DD/YY h:mm A') +
      '\n\n' +
      'Player Name: ' +
      playerName +
      '\n\n' +
      'Parent Phone: ' +
      parentPhone +
      '\n\n' +
      'Parent Email: ' +
      parentEmail +
      '\n\n';

    const sendTo = 'lsbyerley@gmail.com';
    //const sendTo = 'rbifrontdesk@gmail.com'

    const res = await mailgun.messages().send({
      from: 'RBI Tri-Cities <no-reply@rbitricities.com>',
      to: sendTo,
      subject: `👋 Private Instruction Form Submission`,
      text: `${message}`, //,
      //html: `<h1> Hello ${name}</h1>`
    });
    return {
      error: false,
    };
  } catch (error) {
    console.error('sendEmailError', error);
    return {
      error: true,
      message: error.message,
    };
  }
};

module.exports = sendEmail;
