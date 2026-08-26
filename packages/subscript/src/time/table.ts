/** Zone catalog: fixed offsets (`PST`) and IANA zones (`America/Los_Angeles`). */
export type ZoneKind = "offset" | "iana";

export type ZoneSource = {
  readonly citation: string;
  readonly url?: string;
  readonly notes?: string;
};

export type OffsetZone = {
  readonly id: string;
  readonly kind: "offset";
  readonly label: string;
  readonly offsetMinutes: number;
  readonly source: ZoneSource;
};

export type IanaZone = {
  readonly id: string;
  readonly kind: "iana";
  readonly label: string;
  readonly iana: string;
  readonly source: ZoneSource;
};

export type ZoneDef = OffsetZone | IanaZone;

const OFFSET_SOURCE: ZoneSource = {
  citation: "Civil offset, not tzdb rules",
};

const IANA_SOURCE: ZoneSource = {
  citation: "IANA Time Zone Database",
  url: "https://www.iana.org/time-zones",
};

function offset(id: string, offsetMinutes: number, label: string, notes?: string): OffsetZone {
  return {
    id,
    kind: "offset",
    label,
    offsetMinutes,
    source: notes === undefined ? OFFSET_SOURCE : { ...OFFSET_SOURCE, notes },
  };
}

function iana(id: string, ianaId: string, label: string, notes?: string): IanaZone {
  return {
    id,
    kind: "iana",
    label,
    iana: ianaId,
    source: notes === undefined ? IANA_SOURCE : { ...IANA_SOURCE, notes },
  };
}

export const ZONES: readonly ZoneDef[] = [
  offset("pst", -480, "PST"),
  offset("pdt", -420, "PDT"),
  offset("mst", -420, "MST"),
  offset("mdt", -360, "MDT"),
  offset("cst", -360, "CST"),
  offset("cdt", -300, "CDT"),
  offset("est", -300, "EST"),
  offset("edt", -240, "EDT"),
  offset("akst", -540, "AKST"),
  offset("akdt", -480, "AKDT"),
  offset("hst", -600, "HST"),
  offset("bst", 60, "BST", "British Summer Time, not Bangladesh"),

  iana("america-los-angeles", "America/Los_Angeles", "PT"),
  iana("america-denver", "America/Denver", "MT"),
  iana("america-chicago", "America/Chicago", "CT"),
  iana("america-new-york", "America/New_York", "ET"),
  iana("america-anchorage", "America/Anchorage", "AKT"),
  iana("pacific-honolulu", "Pacific/Honolulu", "HT"),
  iana("america-phoenix", "America/Phoenix", "MST"),
  iana("america-toronto", "America/Toronto", "ET"),
  iana("america-vancouver", "America/Vancouver", "PT"),
  iana("america-mexico-city", "America/Mexico_City", "CT"),
  iana("america-sao-paulo", "America/Sao_Paulo", "BRT"),
  iana("asia-tokyo", "Asia/Tokyo", "JST"),
  iana("asia-kolkata", "Asia/Calcutta", "IST"),
  iana("asia-shanghai", "Asia/Shanghai", "CST"),
  iana("asia-singapore", "Asia/Singapore", "SGT"),
  iana("asia-hong-kong", "Asia/Hong_Kong", "HKT"),
  iana("asia-seoul", "Asia/Seoul", "KST"),
  iana("asia-dubai", "Asia/Dubai", "GST"),
  iana("asia-jerusalem", "Asia/Jerusalem", "IST"),
  iana("asia-kathmandu", "Asia/Katmandu", "NPT"),
  iana("australia-sydney", "Australia/Sydney", "AET"),
  iana("pacific-auckland", "Pacific/Auckland", "NZT"),
  iana("europe-london", "Europe/London", "GMT"),
  iana("europe-paris", "Europe/Paris", "CET"),
  iana("europe-berlin", "Europe/Berlin", "CET"),
  iana("europe-dublin", "Europe/Dublin", "IST"),
  iana("europe-rome", "Europe/Rome", "CET"),
  iana("europe-moscow", "Europe/Moscow", "MSK"),
  iana("africa-cairo", "Africa/Cairo", "EET"),
  iana("africa-johannesburg", "Africa/Johannesburg", "SAST"),
];

const BY_ID = new Map(ZONES.map((zone) => [zone.id, zone]));

export function catalogZone(id: string): ZoneDef | undefined {
  return BY_ID.get(id);
}
