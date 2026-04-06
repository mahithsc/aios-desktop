import { useEffect, useState, type JSX } from 'react'

type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'

type CurrentWeatherResponse = {
  current?: {
    temperature_2m?: number
    weather_code?: number
    is_day?: number
  }
}

type ReverseGeocodeResponse = {
  address?: {
    city?: string
    town?: string
    village?: string
    hamlet?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
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

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 10 * 60 * 1_000
} as const

const formatLocalTime = (): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })
    .format(new Date())
    .toLowerCase()

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

const getLocationLabel = (payload: ReverseGeocodeResponse): string | null => {
  const address = payload.address
  if (!address) {
    return null
  }

  const locality =
    address.city ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.municipality ??
    address.county

  if (!locality) {
    return address.state ?? address.country ?? null
  }

  return locality
}

const LocalEnvironmentCard = (): JSX.Element => {
  const [timeLabel, setTimeLabel] = useState(() => formatLocalTime())
  const [locationLabel, setLocationLabel] = useState('Locating...')
  const [temperatureLabel, setTemperatureLabel] = useState('--°')
  const [weatherKind, setWeatherKind] = useState<WeatherKind>('sunny')

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeLabel(formatLocalTime())
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel('Location unavailable')
      return
    }

    let isCancelled = false
    const abortController = new AbortController()

    const syncEnvironment = async (latitude: number, longitude: number): Promise<void> => {
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast')
      weatherUrl.searchParams.set('latitude', String(latitude))
      weatherUrl.searchParams.set('longitude', String(longitude))
      weatherUrl.searchParams.set('current', 'temperature_2m,weather_code,is_day')
      weatherUrl.searchParams.set('temperature_unit', 'fahrenheit')

      const geocodeUrl = new URL('https://nominatim.openstreetmap.org/reverse')
      geocodeUrl.searchParams.set('lat', String(latitude))
      geocodeUrl.searchParams.set('lon', String(longitude))
      geocodeUrl.searchParams.set('format', 'jsonv2')
      geocodeUrl.searchParams.set('zoom', '10')
      geocodeUrl.searchParams.set('addressdetails', '1')

      const [weatherResult, locationResult] = await Promise.allSettled([
        fetch(weatherUrl, { signal: abortController.signal }).then(async (response) => {
          if (!response.ok) {
            throw new Error('Weather request failed.')
          }

          return (await response.json()) as CurrentWeatherResponse
        }),
        fetch(geocodeUrl, { signal: abortController.signal }).then(async (response) => {
          if (!response.ok) {
            throw new Error('Location request failed.')
          }

          return (await response.json()) as ReverseGeocodeResponse
        })
      ])

      if (isCancelled) {
        return
      }

      if (weatherResult.status === 'fulfilled') {
        const current = weatherResult.value.current
        if (typeof current?.temperature_2m === 'number') {
          setTemperatureLabel(`${Math.round(current.temperature_2m)}°F`)
        }

        setWeatherKind(mapWeatherCodeToKind(current?.weather_code))
      }

      if (locationResult.status === 'fulfilled') {
        const nextLocationLabel = getLocationLabel(locationResult.value)
        setLocationLabel(nextLocationLabel ?? 'Location unavailable')
      } else {
        setLocationLabel('Location unavailable')
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isCancelled) {
          return
        }

        void syncEnvironment(position.coords.latitude, position.coords.longitude)
      },
      () => {
        if (isCancelled) {
          return
        }

        setLocationLabel('Location unavailable')
      },
      GEOLOCATION_OPTIONS
    )

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
