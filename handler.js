'use strict';

const axios = require('axios')
const dayjs = require('dayjs')
const _find = require('lodash/find')
const _get = require('lodash/get')

const resourcesUrl = 'https://api.mindbodyonline.com/public/v6/site/resources'
const tokenUrl = 'https://api.mindbodyonline.com/public/v6/usertoken/issue'
const apptUrl = 'https://api.mindbodyonline.com/public/v6/appointment/staffappointments'

const AWS = require('aws-sdk')
AWS.config.update({region: 'us-east-1'});
const docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
const getItemParams = {
  TableName: 'MBOToken',
  Key: {'ID': 1}
};

const usesb = false;
const siteId = (usesb) ? process.env.MINDBODY_SITE_ID_SANDBOX : process.env.MINDBODY_SITE_ID;
let accessToken = ''

const cageSchedule = async () => {

  try {
    const dbItem = await docClient.get(getItemParams).promise()
    const updatedAt = dayjs(dbItem.Item.UPDATED_AT)
    const minutesOld = dayjs().diff(updatedAt, 'minute')
    let usingFreshToken = false;

    if (minutesOld > 60) { 
      console.log('using fresh token')
      accessToken = await getAccessToken();
      usingFreshToken = true;

    } else {
      console.log('using stored token')
      accessToken = dbItem.Item.ACCESS_TOKEN
    }

    const resData = await axios.get(resourcesUrl, {
      headers: {
        'Api-Key': process.env.MINDBODY_API_KEY,
        'SiteId': siteId,
        'Authorization': accessToken
      }
    })
    const apptData = await axios.get(apptUrl, {
      params: {
        startDate: '2019-07-31T00:00:00',
        endDate: '2019-07-31T23:59:59'
      },
      headers: {
        'Api-Key': process.env.MINDBODY_API_KEY,
        'SiteId': siteId,
        'Authorization': accessToken
      }
    })

    const resources = resData.data.Resources;
    const appointments = apptData.data.Appointments;

    return {
      error: false,
      token: {
        minutesOld,
        usingFreshToken
      },
      cageSchedule: buildCageSchedule(resources, appointments)
    }

  } catch(err) {
    console.error(err)
    return {
      error: true,
      errorNote: err.message || 'no error message'
    }
  }

}

function buildCageSchedule(resources, appointments) {

  let cageSchedules = [];
  resources.forEach((r) => {

    let rMap = {
      id: r.ID,
      name: r.Name,
      appointments: []
    };

    appointments.forEach((a) => {
      if (a.Resources.length > 0) {
        if ( _find(a.Resources, { 'Id': r.Id }) ) {
          const aStartTime = dayjs(a.StartDateTime).format("h:mm a");
          const aEndTime = dayjs(a.EndDateTime).format("h:mm a");
          rMap.appointments.push({
            aStartTime,
            aEndTime
          })
        }
      }
    })
    cageSchedules.push(rMap);

  })

  return cageSchedules;

}

async function getAccessToken() {
  const res = await axios.post(tokenUrl, 
    {
      Username: process.env.MINDBODY_USERNAME,
      Password: process.env.MINDBODY_PASSWORD
    }, 
    {
      headers: {
        'Api-Key': process.env.MINDBODY_API_KEY,
        'SiteId': siteId
      }
    }
  );
  
  const updateItemParams = {
    TableName: 'MBOToken',
    Key: {'ID': 1},
    UpdateExpression: 'set ACCESS_TOKEN = :at, UPDATED_AT = :ua',
    ExpressionAttributeValues: {
      ':at' : res.data.AccessToken,
      ':ua' : dayjs().format('M/D/YYYY h:m a')
    }
  }
  await docClient.update(updateItemParams).promise()

  return res.data.AccessToken
}

module.exports.cageSchedule = async (event, context) => {

  //let useSb = _get(event, 'pathParameters.useSandbox') || false;
  let res = await cageSchedule()

  if (!res.error) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({...res})
    };
  } else {
    return {
      statusCode: 500,
      body: JSON.stringify({...res})
    };
  }

};
