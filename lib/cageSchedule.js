'use strict';

const axios = require('axios')
const dayjs = require('dayjs')
const _find = require('lodash/find')
//const _orderBy = require('lodash/orderBy')
const timezone = process.env.TZ // aws lambda reserved env variable
const resourcesUrl = 'https://api.mindbodyonline.com/public/v6/site/resources'
const tokenUrl = 'https://api.mindbodyonline.com/public/v6/usertoken/issue'
const apptUrl = 'https://api.mindbodyonline.com/public/v6/appointment/staffappointments'
const dynamodb = require('./dynamodb');
const usesb = false;
const siteId = (usesb) ? process.env.MINDBODY_SITE_ID_SANDBOX : process.env.MINDBODY_SITE_ID;
let accessToken = ''

let date = dayjs();
if (timezone === ':UTC') {
  date = date.subtract(5, 'hour') // UTC offset -5 hours for EST
}

let apptStartDate = dayjs(date).format('YYYYMMDD') + 'T00:00:00'
let apptEndDate = dayjs(date).format('YYYYMMDD') + 'T23:59:59'

const getItemParams = {
  TableName: 'MBOToken',
  Key: {'ID': 1}
};

const cageSchedule = async () => {

  try {
    const dbItem = await dynamodb.get(getItemParams).promise()
    const updatedAt = dayjs(dbItem.Item.UPDATED_AT)
    const minutesOld = Math.abs(date.diff(updatedAt, 'minute'))
    let usingFreshToken = false;

    if (minutesOld > 60) { 
      console.log('getting fresh token')
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
        startDate: apptStartDate,
        endDate: apptEndDate
      },
      headers: {
        'Api-Key': process.env.MINDBODY_API_KEY,
        'SiteId': siteId,
        'Authorization': accessToken
      }
    })

    const resources = resData.data.Resources;
    const appointments = apptData.data.Appointments;
    const cageSchedule = buildCageSchedule(resources, appointments)

    return {
      error: false,
      token: {
        minutesOld,
        usingFreshToken
      },
      apptStartDate,
      apptEndDate,
      scheduleDate: dayjs(date).format('MMMM D, YYYY'),
      cageSchedule: cageSchedule
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

  //cageSchedules = _orderBy(cageSchedules, ['name'], ['asc'])

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
      ':ua' : date.format('M/D/YYYY h:m a')
    }
  }
  await dynamodb.update(updateItemParams).promise()

  return res.data.AccessToken
}

module.exports = cageSchedule