import { useEffect, useState, type JSX } from 'react'

type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'

type GeoLocationResponse = {
  city?: string
  region?: string
  latitude?: number | string
  longitude?: number | string
  timezone?: string
}

type CurrentWeatherResponse = {
  current?: {
    temperature_2m?: number
    weather_code?: number
  }
}

const WEATHER_BACKGROUND_BY_KIND: Record<WeatherKind, string> = {
  sunny:
    'linear-gradient(180deg, rgba(41,145,244,0.96) 0%, rgba(86,176,249,0.92) 48%, rgba(165,216,255,0.92) 100%)',
  cloudy:
    'linear-gradient(180deg, rgba(93,110,130,0.96) 0%, rgba(132,148,168,0.93) 52%, rgba(188,197,209,0.92) 100%)',
  rain:
    'linear-gradient(180deg, rgba(49,69,94,0.97) 0%, rgba(84,110,138,0.94) 56%, rgba(127,154,183,0.9) 100%)',
  storm:
    'linear-gradient(180deg, rgba(29,35,52,0.98) 0%, rgba(60,69,99,0.95) 48%, rgba(101,112,150,0.9) 100%)',
  snow:
    'linear-gradient(180deg, rgba(207,224,238,0.96) 0%, rgba(224,236,246,0.94) 50%, rgba(244,248,252,0.92) 100%)',
  fog:
    'linear-gradient(180deg, rgba(140,149,160,0.96) 0%, rgba(170,177,186,0.94) 52%, rgba(210,214,219,0.92) 100%)'
}

const formatLocalTime = (timeZone?: string): string => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  })

  return formatter.format(new Date()).toLowerCase()
}

const mapWeatherCodeToKind = (weatherCode?: number): WeatherKind => {
  if (weatherCode === 0) {
    return 'sunny'
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return 'fog'
  }

  if ([1, 2, 3].includes(weatherCode ?? -1)) {
    return 'cloudy'
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode ?? -1)) {
    return 'rain'
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode ?? -1)) {
    return 'snow'
  }

  if ([95, 96, 99].includes(weatherCode ?? -1)) {
    return 'storm'
  }

  return 'cloudy'
}

const getWeatherLabel = (weatherCode?: number): string => {
  if (weatherCode === 0) {
    return 'Sunny'
  }

  if (weatherCode === 1) {
    return 'Mostly clear'
  }

  if (weatherCode === 2) {
    return 'Partly cloudy'
  }

  if (weatherCode === 3) {
    return 'Overcast'
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return 'Foggy'
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode ?? -1)) {
    return 'Drizzle'
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode ?? -1)) {
    return 'Rain'
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode ?? -1)) {
    return 'Snow'
  }

  if ([95, 96, 99].includes(weatherCode ?? -1)) {
    return 'Thunderstorm'
  }

  return 'Cloudy'
}

const LocalEnvironmentCard = (): JSX.Element => {
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined)
  const [timeLabel, setTimeLabel] = useState(() => formatLocalTime())
  const [locationLabel, setLocationLabel] = useState('Locating...')
  const [temperatureLabel, setTemperatureLabel] = useState('--°')
  const [weatherLabel, setWeatherLabel] = useState('Weather')
  const [weatherKind, setWeatherKind] = useState<WeatherKind>('sunny')

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeLabel(formatLocalTime(timeZone))
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [timeZone])

  useEffect(() => {
    let isCancelled = false
    const abortController = new AbortController()

    const syncEnvironment = async (): Promise<void> => {
      const locationResponse = await fetch('https://get.geojs.io/v1/ip/geo.json', {
        signal: abortController.signal
      })
      if (!locationResponse.ok) {
        throw new Error('Location request failed.')
      }

      const locationPayload = (await locationResponse.json()) as GeoLocationResponse
      const latitude =
        typeof locationPayload.latitude === 'number'
          ? locationPayload.latitude
          : Number.parseFloat(locationPayload.latitude ?? '')
      const longitude =
        typeof locationPayload.longitude === 'number'
          ? locationPayload.longitude
          : Number.parseFloat(locationPayload.longitude ?? '')

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Location coordinates unavailable.')
      }

      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast')
      weatherUrl.searchParams.set('latitude', `${latitude}`)
      weatherUrl.searchParams.set('longitude', `${longitude}`)
      weatherUrl.searchParams.set('current', 'temperature_2m,weather_code,is_day')
      weatherUrl.searchParams.set('temperature_unit', 'fahrenheit')

      const weatherResponse = await fetch(weatherUrl, {
        signal: abortController.signal
      })
      if (!weatherResponse.ok) {
        throw new Error('Weather request failed.')
      }

      const weatherPayload = (await weatherResponse.json()) as CurrentWeatherResponse

      if (isCancelled) {
        return
      }

      const nextLocationLabel = [locationPayload.city, locationPayload.region]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(', ')

      setLocationLabel(nextLocationLabel || 'Location unavailable')
      setTimeZone(locationPayload.timezone)
      setTimeLabel(formatLocalTime(locationPayload.timezone))

      const current = weatherPayload.current
      if (typeof current?.temperature_2m === 'number') {
        setTemperatureLabel(`${Math.round(current.temperature_2m)}°F`)
      }

      setWeatherLabel(getWeatherLabel(current?.weather_code))
      setWeatherKind(mapWeatherCodeToKind(current?.weather_code))
    }

    void syncEnvironment().catch(() => {
      if (isCancelled) {
        return
      }

      setLocationLabel('Location unavailable')
    })

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [])

  const backgroundImage = WEATHER_BACKGROUND_BY_KIND[weatherKind]

  return (
    <div className="h-40 w-40">
      <div
        className="h-full w-full rounded-[1.5rem] p-3.5 shadow-sm"
        style={{
          backgroundImage
        }}
      >
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="text-[1.65rem] font-light tracking-tight text-white">
              {timeLabel}
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-white/90">
              {weatherLabel}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[12px] font-medium text-white">
              {locationLabel}
            </div>
            <div className="text-[12px] font-medium text-white">
              {temperatureLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocalEnvironmentCard
