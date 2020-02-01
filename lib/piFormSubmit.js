const { MAILGUN_API_KEY, MAILGUN_HOST, MAILGUN_SANDBOX_HOST } = process.env
const mailgun = require('mailgun-js')({
  apiKey: MAILGUN_API_KEY, 
  domain: MAILGUN_SANDBOX_HOST
});

const sendEmail = async ({ playerName, parentPhone, parentEmail }) => {
  console.log('Sending email')

  try {

    const message = 'The following information was just submitted for a private instruction: \n\n' +
    'Player Name: ' + playerName + '\n\n' +
    'Parent Phone: ' + parentPhone + '\n\n' +
    'Parent Email: ' + parentEmail + '\n\n';

    const sendTo = 'lsbyerley@gmail.com'

    const res = await mailgun.messages().send({
      from: 'RBI Tri-Cities <no-reply@rbitricities.com>',
      to: sendTo,
      subject: `👋 Private Instruction Form Submission`,
      text: `${message}`//,
      //html: `<h1> Hello ${name}</h1>`
    })
    return {
      error: false
    }

  } catch (error) {
    console.log('message',error.message)
    console.error('sendEmailError', error)
    return {
      error: true,
      message: error.message
    }
  }

}

module.exports = sendEmail;