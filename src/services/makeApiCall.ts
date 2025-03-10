
import axios, { AxiosError } from 'axios'
import { error } from '../core.error'


const apiCall = axios.create({ method: 'get' })

type ApiCallConfig = Partial<{
  errorHandling: 'throw' | 'log'
  body: Record<string, any>
}> & Parameters<typeof apiCall>[1]

export async function makeApiCall(ctx, url: string, config?: ApiCallConfig) {

  const { errorHandling = 'throw', body, data: dta, ...axiosConf } = config || {}

  try {
    const { data } = await apiCall({
      url,
      data: body || dta,
      ...axiosConf,
    })
    return data
  } catch (err) {
    const axiosErr: AxiosError<any> = err


    const doNotThrow = errorHandling !== 'throw'

    const errMsg = err.response?.statusText
    const responseData = axiosErr.response?.data
    const respStatus = axiosErr.response?.status

    error.applicationError(ctx, errMsg, {
      err,
      code: respStatus || 500,
      responseData,
      doNotThrow,
    })
  }
}