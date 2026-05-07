const KEY = 'loudness-meter-cal-offset'

export function getOffset() {
  return parseFloat(localStorage.getItem(KEY) ?? '0')
}

export function setOffset(dbfsMeasured, dbsplActual) {
  const offset = dbsplActual - dbfsMeasured
  localStorage.setItem(KEY, String(offset))
  return offset
}

export function applyOffset(dbfs) {
  return dbfs + getOffset()
}
