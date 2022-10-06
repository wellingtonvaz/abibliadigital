import dotenv from 'dotenv'
import moment from 'moment'
import redis from 'redis'
import { promisify } from 'util'

import { genericError } from '../helpers/index'

dotenv.config()

const { REDIS_URL } = process.env

const cache = redis.createClient(REDIS_URL)

const getAsync = promisify(cache.get).bind(cache)

export const startRedis = () => {
  /* istanbul ignore next */
  cache.on('error', function (err) {
    console.log('Redis:error: ' + err)
  })
}

export const checkRateLimit = async (req, res, next) => {
  if (req.user) return next()
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  await getAsync(ip).then((response) => {
    const data = {
      lastTime: moment(),
      count: 1
    }
    if (response) {
      const current = JSON.parse(response)
      data.count = current.count + 1
      if (current.count > 20 && moment().diff(current.lastTime, 'hour') < 1) {
        return res.status(409).json({
          msg: 'Too many accounts created from this IP, please try again after an hour or login'
        })
      }
    }
    cache.set(ip, JSON.stringify(data), 'EX', 300)
    next()
  }).catch((err) => {
    /* istanbul ignore next */
    return genericError(res, err)
  })
}
