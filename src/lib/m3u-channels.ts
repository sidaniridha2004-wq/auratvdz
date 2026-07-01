// Static M3U channel catalogue — the primary server for matches.
// Kept client-safe (no server imports) so both UI and probe route can use it.

export interface M3uChannel {
  slug: string;
  name: string;
  group: string;
  logo: string;
  url: string;
  /** Optional match-channel alias key (e.g. "beIN Max 1") for scoring/matching. */
  matchAlias?: string;
}

const BEIN_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/BeIN_Sports_logo.png/200px-BeIN_Sports_logo.png";
const BEIN_MAX_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Logo_beIN_SPORTS_MAX.png/200px-Logo_beIN_SPORTS_MAX.png";
const MBC_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/MBC_logo.svg/200px-MBC_logo.svg.png";
const CANAL_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Canal%2B_logo.svg/200px-Canal%2B_logo.svg.png";
const FRANCE_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/France_T%C3%A9l%C3%A9visions_logo_2018.svg/200px-France_T%C3%A9l%C3%A9visions_logo_2018.svg.png";
const OSN_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/OSN_2020_logo.svg/200px-OSN_2020_logo.svg.png";
const ALG_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Flag_of_Algeria.svg/200px-Flag_of_Algeria.svg.png";
const NATGEO_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/National_Geographic_logo.svg/200px-National_Geographic_logo.svg.png";
const DISNEY_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Disney_Channel_logo.svg/200px-Disney_Channel_logo.svg.png";
const NICK_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Nickelodeon_logo.svg/200px-Nickelodeon_logo.svg.png";
const TF1_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/TF1_logo_2013.svg/200px-TF1_logo_2013.svg.png";
const FRANCE2_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/France_2_logo_%282008%29.svg/200px-France_2_logo_%282008%29.svg.png";
const FRANCE3_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/France_3_-_Logo_2008.svg/200px-France_3_-_Logo_2008.svg.png";
const FRANCE4_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/France_4_logo.svg/200px-France_4_logo.svg.png";
const FRANCE5_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/France_5_logo_2002.svg/200px-France_5_logo_2002.svg.png";
const W9_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/W9_logo.svg/200px-W9_logo.svg.png";
const SIXTER_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/6ter_Logo.svg/200px-6ter_Logo.svg.png";
const CHERIE25_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Ch%C3%A9rie_25_logo.svg/200px-Ch%C3%A9rie_25_logo.svg.png";
const TELETOON_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/T%C3%A9l%C3%A9toon_logo.svg/200px-T%C3%A9l%C3%A9toon_logo.svg.png";

export const M3U_CHANNELS: M3uChannel[] = [
  // beIN Sports MAX — PRIMARY server for match streams
  { slug: "bein-max-1", name: "beIN SPORTS MAX 1", group: "beIN Sports MAX", logo: BEIN_MAX_LOGO, url: "https://table.houseinventer.com/pdf/AzMjD2IyADQPb2tLfQ/index.m3u8?token==", matchAlias: "beIN Max 1" },
  { slug: "bein-max-2", name: "beIN SPORTS MAX 2", group: "beIN Sports MAX", logo: BEIN_MAX_LOGO, url: "https://table.houseinventer.com/pdf/AzMjD2IyADQPb2dLfQ/index.m3u8?token==", matchAlias: "beIN Max 2" },
  { slug: "bein-max-3", name: "beIN SPORTS MAX 3", group: "beIN Sports MAX", logo: BEIN_MAX_LOGO, url: "https://table.houseinventer.com/pdf/cTMhX14BDE0/index.m3u8?token==", matchAlias: "beIN Max 3" },
  { slug: "bein-max-4", name: "beIN SPORTS MAX 4", group: "beIN Sports MAX", logo: BEIN_MAX_LOGO, url: "https://table.houseinventer.com/pdf/cTMhX14BDE1/index.m3u8?token==", matchAlias: "beIN Max 4" },
  { slug: "bein-max-5", name: "beIN SPORTS MAX 5", group: "beIN Sports MAX", logo: BEIN_MAX_LOGO, url: "https://table.houseinventer.com/pdf/fGxnXkcRABYyNE0TfQ/index.m3u8?token==", matchAlias: "beIN Max 5" },
  { slug: "bein-max-6", name: "beIN SPORTS MAX 6", group: "beIN Sports MAX", logo: BEIN_MAX_LOGO, url: "https://table.houseinventer.com/pdf/cG5tXl8cAlZxKhAXJnE/index.m3u8?token==", matchAlias: "beIN Max 6" },

  // beIN Sports (Arabic + English)
  { slug: "bein-1-eng", name: "beIN SPORTS 1 ENG", group: "beIN Sports", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGgncCxhWANNAAoFGXFhZ3E/index.m3u8?token==" },
  { slug: "bein-1", name: "beIN SPORTS 1", group: "beIN Sports", logo: BEIN_LOGO, url: "https://ind.decentdoubts.net/7uyHHNNBB6tr9/index.m3u8?token==" },
  { slug: "bein-2-eng", name: "beIN SPORTS 2 ENG", group: "beIN Sports", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGhtI286DlZABSoPaB1uGHE/index.m3u8?token==" },
  { slug: "bein-2", name: "beIN SPORTS 2", group: "beIN Sports", logo: BEIN_LOGO, url: "https://ind.decentdoubts.net/NUR72g5b8c77hY/index.m3u8?token==" },
  { slug: "bein-3", name: "beIN SPORTS 3", group: "beIN Sports", logo: BEIN_LOGO, url: "https://ind.decentdoubts.net/184g7j2hd6s5/index.m3u8?token==" },
  { slug: "bein-4", name: "beIN SPORTS 4", group: "beIN Sports", logo: BEIN_LOGO, url: "https://ind.decentdoubts.net/m92h7g3dGG65/index.m3u8?token==" },
  { slug: "bein-6", name: "beIN SPORTS 6", group: "beIN Sports", logo: BEIN_LOGO, url: "https://ind.decentdoubts.net/098b6n2v5GG5tR4/index.m3u8?token==" },
  { slug: "bein-7", name: "beIN SPORTS 7", group: "beIN Sports", logo: BEIN_LOGO, url: "https://ind.decentdoubts.net/OQGB87j3v9x4b6hg/index.m3u8?token==" },
  { slug: "bein-news", name: "beIN SPORTS NEWS", group: "News", logo: BEIN_LOGO, url: "https://ind.decentdoubts.net/m8n4rf6tGB65/index.m3u8?token==" },
  { slug: "bein-fr-1", name: "beIN SPORTS FR HD 1", group: "beIN Sports", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGhjcWoccUECBVYlaUYcITkK/index.m3u8?token==" },
  { slug: "bein-fr-2", name: "beIN SPORTS FR HD 2", group: "beIN Sports", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGhtcGtnfnINCSAMZhIL/index.m3u8?token==" },

  // beIN entertainment / documentary
  { slug: "bein-baraem", name: "beIN Baraem HD", group: "Kids", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGhsfxcef3g2UlY1GAo/index.m3u8?token==" },
  { slug: "bein-drama-1", name: "beIN Drama HD 1", group: "General", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGg7BRceAV1GEQQ2GHcRfQ/index.m3u8?token==" },
  { slug: "bein-dreamworks", name: "beIN Dream Works", group: "Kids", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGhse2lmXkwaDyAACndiFmsTCw/index.m3u8?token==" },
  { slug: "bein-fatafeat", name: "beIN Fatafeat HD", group: "Lifestyle", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGhlcWFnXkwMChcPGXEWa3E/index.m3u8?token==" },
  { slug: "bein-natgeo-wild", name: "beIN Nat Geo Wild HD", group: "Documentary", logo: NATGEO_LOGO, url: "http://cloth.orangecord.net/pdf/OSNNatGeoWildHD/index.m3u8?token==" },
  { slug: "bein-outdoor", name: "beIN Outdoor", group: "Documentary", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGgfBRMeYwJCVABxKhJROnE/index.m3u8?token==" },
  { slug: "bein-series-1", name: "beIN Series HD 1", group: "Series", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGgcChFjAABFXghwNmdjBnE/index.m3u8?token==" },
  { slug: "bein-series-2", name: "beIN Series HD 2", group: "Series", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGg-cDRnDw1FVVUlOUNnFBp3Cw/index.m3u8?token==" },
  { slug: "bein-disney-jr", name: "beIN Disney Junior", group: "Kids", logo: BEIN_LOGO, url: "http://stream.woodfencepods.com/pdf/IC0gRg9bSFNxbAsWZmkLFRZASWV7fGg-cDRlVAwZVwBzFmJ9ZGsK/index.m3u8?token==" },

  // Canal+ France
  { slug: "canal", name: "CANAL+", group: "Canal+ France", logo: CANAL_LOGO, url: "http://cloth.orangecord.net/pdf/FR-CANAL/index.m3u8?token==" },
  { slug: "canal-d", name: "CANAL D", group: "Canal+ France", logo: CANAL_LOGO, url: "http://3242ftgdgfdhtryt.probechef.net:8080/2287341/index.m3u8?token==" },
  { slug: "canal-sport", name: "CANAL+ Sport", group: "Sports", logo: CANAL_LOGO, url: "http://stream.bottledesk.net/p/cmdZMXV9CgQGFxZkY2s/index.m3u8?token==" },
  { slug: "canal-vie", name: "CANAL Vie HD", group: "Canal+ France", logo: CANAL_LOGO, url: "http://stream.billyphilly.com/p/W10GdgR6VVY/index.m3u8?token==" },
  { slug: "chasse-peche", name: "Chasse & Pêche", group: "Lifestyle", logo: "", url: "http://cloth.orangecord.net/pdf/FR-CHASSE/index.m3u8?token==" },
  { slug: "cherie-25", name: "Chérie 25", group: "French TV", logo: CHERIE25_LOGO, url: "http://cloth.orangecord.net/pdf/FR-CHERIE25/index.m3u8?token==" },
  { slug: "cine-emotion", name: "Ciné Emotion HD", group: "Movies", logo: "", url: "http://cloth.orangecord.net/pdf/FR-CINEEMOTION/index.m3u8?token==" },
  { slug: "cine-pop", name: "Ciné Pop", group: "Movies", logo: "", url: "http://stream.cammonitorplus.net/FR1003/index.m3u8?token==" },
  { slug: "cine-premier", name: "Ciné Premier", group: "Movies", logo: "", url: "http://cloth.orangecord.net/pdf/FR-CINEPREMIER/index.m3u8?token==" },
  { slug: "cine-frisson", name: "Ciné Frisson", group: "Movies", logo: "", url: "http://stream.cammonitorplus.net/FR1006/index.m3u8?token==" },

  // French TV
  { slug: "tf1", name: "TF1", group: "French TV", logo: TF1_LOGO, url: "http://cloth.orangecord.net/pdf/FR-TF1/index.m3u8?token==" },
  { slug: "france-2", name: "France 2", group: "French TV", logo: FRANCE2_LOGO, url: "http://cloth.orangecord.net/pdf/FR-FRANCE2/index.m3u8?token==" },
  { slug: "france-3", name: "France 3", group: "French TV", logo: FRANCE3_LOGO, url: "http://cloth.orangecord.net/pdf/FR-FRANCE3/index.m3u8?token==" },
  { slug: "france-4", name: "France 4", group: "French TV", logo: FRANCE4_LOGO, url: "http://cloth.orangecord.net/pdf/FR-FRANCE4/index.m3u8?token==" },
  { slug: "france-5", name: "France 5", group: "French TV", logo: FRANCE5_LOGO, url: "http://cloth.orangecord.net/pdf/FR-FRANCE5/index.m3u8?token==" },
  { slug: "france-foot", name: "France Foot", group: "French TV", logo: FRANCE_LOGO, url: "http://cloth.orangecord.net/pdf/FR-FRANCE0/index.m3u8?token==" },
  { slug: "w9", name: "W9", group: "French TV", logo: W9_LOGO, url: "http://cloth.orangecord.net/pdf/W9_FR/index.m3u8?token==" },
  { slug: "6ter", name: "6TER HD", group: "French TV", logo: SIXTER_LOGO, url: "http://cloth.orangecord.net/pdf/FR-6TERHD/index.m3u8?token==" },
  { slug: "paris-premier", name: "Paris Première", group: "French TV", logo: "", url: "http://cloth.orangecord.net/pdf/FR-PARISPREMIERE/index.m3u8?token==" },
  { slug: "city-montreal", name: "City Montreal", group: "French TV", logo: "", url: "http://stream.cammonitorplus.net/FR1004/index.m3u8?token==" },
  { slug: "disney-fr", name: "Disney Channel FR", group: "Kids", logo: DISNEY_LOGO, url: "http://cloth.orangecord.net/pdf/FR-DISNEYCHANNEL/index.m3u8?token==" },
  { slug: "disney-cinema-fr", name: "Disney Cinema FR", group: "Movies", logo: DISNEY_LOGO, url: "http://cloth.orangecord.net/pdf/DisneyCinema_FR/index.m3u8?token==" },
  { slug: "disney-jr", name: "Disney Junior", group: "Kids", logo: DISNEY_LOGO, url: "http://cloth.orangecord.net/pdf/FR-DISNEYJR/index.m3u8?token==" },
  { slug: "nickelodeon", name: "Nickelodeon", group: "Kids", logo: NICK_LOGO, url: "http://cloth.orangecord.net/pdf/FR-NICKELODEON/index.m3u8?token==" },
  { slug: "teletoon", name: "Teletoon FR", group: "Kids", logo: TELETOON_LOGO, url: "http://cloth.orangecord.net/pdf/FR-TELETOON/index.m3u8?token==" },
  { slug: "natgeo-fr", name: "Nat Geo FR", group: "Documentary", logo: NATGEO_LOGO, url: "http://cloth.orangecord.net/pdf/NATGEO_FR/index.m3u8?token==" },
  { slug: "natgeo-wild-fr", name: "Nat Geo Wild FR", group: "Documentary", logo: NATGEO_LOGO, url: "http://cloth.orangecord.net/pdf/NATGEO_WILD_FR/index.m3u8?token==" },
  { slug: "history-fr", name: "History French", group: "Documentary", logo: "", url: "http://185.246.209.71:8080/3740877/index.m3u8?token==" },
  { slug: "rmc-1", name: "RMC Sport 1", group: "Sports", logo: "", url: "http://stream.bottledesk.net/p/cmdZIFlQODg6NS0HGA/index.m3u8?token==" },
  { slug: "rmc-2", name: "RMC Sport 2", group: "Sports", logo: "", url: "http://stream.bottledesk.net/p/cmdZIFlQODg6NS0EGA/index.m3u8?token==" },
  { slug: "rmc-3", name: "RMC Sport 3", group: "Sports", logo: "", url: "http://stream.bottledesk.net/p/cmdZIFlQODg6NS0FGA/index.m3u8?token==" },
  { slug: "serie-club", name: "Série Club HD", group: "Series", logo: "", url: "http://cloth.orangecord.net/pdf/FR-SERIECLUB/index.m3u8?token==" },
  { slug: "serie-plus", name: "Série +", group: "Series", logo: "", url: "http://stream.billyphilly.com/p/UV0HcgJwU1Y/index.m3u8?token==" },
  { slug: "ushuaia", name: "Ushuaïa", group: "Lifestyle", logo: "", url: "http://cloth.orangecord.net/pdf/FR-USHUAIA/index.m3u8?token==" },
  { slug: "zeste", name: "Zeste", group: "Lifestyle", logo: "", url: "http://stream.cammonitorplus.net/FR10017/index.m3u8?token==" },
  { slug: "action-hd", name: "Action HD", group: "Movies", logo: "", url: "http://cloth.orangecord.net/pdf/FR-ACTIONHD/index.m3u8?token==" },

  // Algeria TV
  { slug: "alg-albilad", name: "AlBilad Algérie", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/AlBilad-ALG/index.m3u8?token==" },
  { slug: "alg-1", name: "Algeria 1", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/alg1/index.m3u8?token==" },
  { slug: "alg-2", name: "Algeria 2", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2CanalAlgerieHD/index.m3u8?token==" },
  { slug: "alg-3", name: "Algeria 3 A3", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/alg3/index.m3u8?token==" },
  { slug: "alg-tamazight-4", name: "Tamazight 4", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2TV4/index.m3u8?token==" },
  { slug: "alg-5-quran", name: "Algeria 5 Quran", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2TV5/index.m3u8?token==" },
  { slug: "alg-7", name: "Algeria TV 7", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2TV7ELMAARIFA/index.m3u8?token==" },
  { slug: "alg-echorouk", name: "Echorouk TV", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2EchoroukTV/index.m3u8?token==" },
  { slug: "alg-echorouk-news", name: "Echorouk News", group: "News", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2EchoroukNEWS/index.m3u8?token==" },
  { slug: "alg-barlamaniya", name: "El Barlamaniya", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2ElBarlamaniya/index.m3u8?token==" },
  { slug: "alg-djazair-n1", name: "El Djazair N1", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2ElDjazairN1/index.m3u8?token==" },
  { slug: "alg-hayat", name: "El Hayat", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2ELHAYATTVALGERIE/index.m3u8?token==" },
  { slug: "alg-wataniya", name: "El Wataniya", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2ElwataniaAlgerie/index.m3u8?token==" },
  { slug: "alg-heddaf", name: "El Heddaf", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2ELHEDDAFTV/index.m3u8?token==" },
  { slug: "alg-ennahar", name: "Ennahar", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2EnnaharTV/index.m3u8?token==" },
  { slug: "alg-samira", name: "Samira TV", group: "Algeria TV", logo: ALG_LOGO, url: "http://cloth.orangecord.net/pdf/sat2SamiraTV/index.m3u8?token==" },
  { slug: "maroc-tamazight", name: "Maroc Tamazight", group: "Maghreb", logo: "", url: "http://cloth.orangecord.net/pdf/sat2Tamazight/index.m3u8?token==" },
  { slug: "tun-wataniya", name: "Tunisia Wataniya", group: "Maghreb", logo: "", url: "http://cloth.orangecord.net/pdf/sat2TunisiaNat1HD/index.m3u8?token==" },
  { slug: "tun-wataniya-2", name: "Tunisia Wataniya 2", group: "Maghreb", logo: "", url: "http://cloth.orangecord.net/pdf/satTunisiaNat2/index.m3u8?token==" },
  { slug: "egy-ontime-sport", name: "ON Time Sport HD", group: "Sports", logo: "", url: "http://stream.woodfencepods.com/pdf/OzggeXsgLi8CDXVrAAp2bGdb/index.m3u8?token==" },

  // MBC
  { slug: "mbc-1", name: "MBC 1 HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3050/index.m3u8?token==" },
  { slug: "mbc-2", name: "MBC 2", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBC2/index.m3u8?token==" },
  { slug: "mbc-2-hd", name: "MBC 2 HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3051/index.m3u8?token==" },
  { slug: "mbc-3", name: "MBC 3", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBC3/index.m3u8?token==" },
  { slug: "mbc-3-hd", name: "MBC 3 HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3052/index.m3u8?token==" },
  { slug: "mbc-4", name: "MBC 4", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBC4/index.m3u8?token==" },
  { slug: "mbc-4-hd", name: "MBC 4 HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3053/index.m3u8?token==" },
  { slug: "mbc-5", name: "MBC 5", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBC5/index.m3u8?token==" },
  { slug: "mbc-5-hd", name: "MBC 5 HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3054/index.m3u8?token==" },
  { slug: "mbc-action", name: "MBC Action", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBCAction/index.m3u8?token==" },
  { slug: "mbc-action-hd", name: "MBC Action HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3056/index.m3u8?token==" },
  { slug: "mbc-bollywood", name: "MBC Bollywood", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBCBollywood/index.m3u8?token==" },
  { slug: "mbc-drama", name: "MBC Drama", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBCDrama/index.m3u8?token==" },
  { slug: "mbc-drama-plus", name: "MBC Drama+ HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3058/index.m3u8?token==" },
  { slug: "mbc-max", name: "MBC Max", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBCMAX/index.m3u8?token==" },
  { slug: "mbc-plus", name: "MBC Plus", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap9/index.m3u8?token==" },
  { slug: "mbc-power", name: "MBC Power", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap14/index.m3u8?token==" },
  { slug: "mbc-premium", name: "MBC Premium", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap1/index.m3u8?token==" },
  { slug: "mbc-premium-2", name: "MBC Premium 2", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap2/index.m3u8?token==" },
  { slug: "mbc-seven", name: "MBC Seven", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap5/index.m3u8?token==" },
  { slug: "mbc-ten", name: "MBC Ten", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap8/index.m3u8?token==" },
  { slug: "mbc-toon", name: "MBC Toon", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap17/index.m3u8?token==" },
  { slug: "mbc-variety", name: "MBC Variety+", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/3064/index.m3u8?token==" },
  { slug: "mbc-zoom", name: "MBC Zoom", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/ap12/index.m3u8?token==" },
  { slug: "mbc-iraq-hd", name: "MBC Iraq HD", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/sat2MBCIRAQHD/index.m3u8?token==" },
  { slug: "mbc-masr", name: "MBC Masr", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/satMBCMASR/index.m3u8?token==" },
  { slug: "mbc-masr-2", name: "MBC Masr 2", group: "MBC", logo: MBC_LOGO, url: "http://cloth.orangecord.net/pdf/satMBCMasr2/index.m3u8?token==" },

  // OSN
  { slug: "osn-action", name: "OSN Movies Action", group: "OSN", logo: OSN_LOGO, url: "http://cloth.orangecord.net/pdf/OSNACTIONHD/index.m3u8?token==" },
  { slug: "osn-family", name: "OSN Movies Family", group: "OSN", logo: OSN_LOGO, url: "http://cloth.orangecord.net/pdf/OSNFAMLY/index.m3u8?token==" },
  { slug: "osn-first", name: "OSN Movies First", group: "OSN", logo: OSN_LOGO, url: "http://cloth.orangecord.net/pdf/OSNMoviesFirst2/index.m3u8?token==" },
  { slug: "osn-showcase", name: "OSN Showcase", group: "OSN", logo: OSN_LOGO, url: "http://cloth.orangecord.net/pdf/OSNMOVIESFIRST/index.m3u8?token==" },
];

export function findChannelBySlug(slug: string): M3uChannel | undefined {
  return M3U_CHANNELS.find((c) => c.slug === slug);
}

/**
 * Resolve a match-channel string (e.g. "beIN Max 1", "بي إن ماكس 2") to a
 * primary M3U channel slug so match cards deep-link to our own stream.
 */
export function resolveMatchChannelSlug(channelName: string): string | null {
  if (!channelName) return null;
  const n = channelName.toLowerCase().replace(/\s+/g, " ").trim();
  // Arabic beIN MAX
  const arMax = n.match(/(?:ماكس|max)\s*([1-6])/);
  if (arMax) return `bein-max-${arMax[1]}`;
  // English beIN Sports MAX N
  const enMax = n.match(/bein[^0-9]*max[^0-9]*([1-6])/);
  if (enMax) return `bein-max-${enMax[1]}`;
  // beIN Sports N (fallback)
  const bein = n.match(/bein[^0-9]*(?:sports?)?[^0-9]*([1-7])/);
  if (bein) return `bein-${bein[1]}`;
  return null;
}

export function channelsByGroup(): Record<string, M3uChannel[]> {
  const out: Record<string, M3uChannel[]> = {};
  for (const c of M3U_CHANNELS) {
    (out[c.group] ??= []).push(c);
  }
  return out;
}
