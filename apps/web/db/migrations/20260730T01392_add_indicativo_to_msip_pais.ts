import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE msip_pais SET indicativo = CASE alfa2
      WHEN 'AF' THEN '93'
      WHEN 'AL' THEN '355'
      WHEN 'AQ' THEN '672'
      WHEN 'DZ' THEN '213'
      WHEN 'AS' THEN '1 684'
      WHEN 'AD' THEN '376'
      WHEN 'AO' THEN '244'
      WHEN 'AG' THEN '1 268'
      WHEN 'AZ' THEN '994'
      WHEN 'AR' THEN '54'
      WHEN 'AU' THEN '61'
      WHEN 'AT' THEN '43'
      WHEN 'BS' THEN '1 242'
      WHEN 'BH' THEN '973'
      WHEN 'BD' THEN '880'
      WHEN 'AM' THEN '374'
      WHEN 'BB' THEN '1 246'
      WHEN 'BE' THEN '32'
      WHEN 'BM' THEN '1 441'
      WHEN 'BT' THEN '975'
      WHEN 'BO' THEN '591'
      WHEN 'BA' THEN '387'
      WHEN 'BW' THEN '267'
      WHEN 'BV' THEN '47'
      WHEN 'BR' THEN '55'
      WHEN 'BZ' THEN '501'
      WHEN 'IO' THEN '246'
      WHEN 'SB' THEN '677'
      WHEN 'VG' THEN '1 284'
      WHEN 'BN' THEN '673'
      WHEN 'BG' THEN '359'
      WHEN 'MM' THEN '95'
      WHEN 'BI' THEN '257'
      WHEN 'BY' THEN '375'
      WHEN 'KH' THEN '855'
      WHEN 'CM' THEN '237'
      WHEN 'CA' THEN '1'
      WHEN 'CV' THEN '238'
      WHEN 'KY' THEN '1 345'
      WHEN 'CF' THEN '236'
      WHEN 'LK' THEN '94'
      WHEN 'TD' THEN '235'
      WHEN 'CL' THEN '56'
      WHEN 'CN' THEN '86'
      WHEN 'TW' THEN '886'
      WHEN 'CX' THEN '61'
      WHEN 'CC' THEN '61'
      WHEN 'CO' THEN '57'
      WHEN 'KM' THEN '269'
      WHEN 'YT' THEN '262'
      WHEN 'CG' THEN '242'
      WHEN 'CD' THEN '243'
      WHEN 'CK' THEN '682'
      WHEN 'CR' THEN '506'
      WHEN 'HR' THEN '385'
      WHEN 'CU' THEN '53'
      WHEN 'CY' THEN '357'
      WHEN 'CZ' THEN '420'
      WHEN 'BJ' THEN '229'
      WHEN 'DK' THEN '45'
      WHEN 'DM' THEN '1 767'
      WHEN 'DO' THEN '1 809'
      WHEN 'EC' THEN '593'
      WHEN 'SV' THEN '503'
      WHEN 'GQ' THEN '240'
      WHEN 'ET' THEN '251'
      WHEN 'ER' THEN '291'
      WHEN 'EE' THEN '372'
      WHEN 'FO' THEN '298'
      WHEN 'FK' THEN '500'
      WHEN 'GS' THEN '500'
      WHEN 'FJ' THEN '679'
      WHEN 'FI' THEN '358'
      WHEN 'AX' THEN '35818'
      WHEN 'FR' THEN '33'
      WHEN 'GF' THEN '594'
      WHEN 'PF' THEN '689'
      WHEN 'TF' THEN '262'
      WHEN 'DJ' THEN '253'
      WHEN 'GA' THEN '241'
      WHEN 'GE' THEN '995'
      WHEN 'GM' THEN '220'
      WHEN 'PS' THEN '970'
      WHEN 'DE' THEN '49'
      WHEN 'GH' THEN '233'
      WHEN 'GI' THEN '350'
      WHEN 'KI' THEN '686'
      WHEN 'GR' THEN '30'
      WHEN 'GL' THEN '299'
      WHEN 'GD' THEN '1 473'
      WHEN 'GP' THEN '590'
      WHEN 'GU' THEN '1 671'
      WHEN 'GT' THEN '502'
      WHEN 'GN' THEN '224'
      WHEN 'GY' THEN '592'
      WHEN 'HT' THEN '509'
      WHEN 'VA' THEN '39'
      WHEN 'HN' THEN '504'
      WHEN 'HK' THEN '852'
      WHEN 'HU' THEN '36'
      WHEN 'IS' THEN '354'
      WHEN 'IN' THEN '91'
      WHEN 'ID' THEN '62'
      WHEN 'IR' THEN '98'
      WHEN 'IQ' THEN '964'
      WHEN 'IE' THEN '353'
      WHEN 'IL' THEN '972'
      WHEN 'IT' THEN '39'
      WHEN 'CI' THEN '225'
      WHEN 'JM' THEN '1 876'
      WHEN 'JP' THEN '81'
      WHEN 'KZ' THEN '7'
      WHEN 'JO' THEN '962'
      WHEN 'KE' THEN '254'
      WHEN 'KP' THEN '850'
      WHEN 'KR' THEN '82'
      WHEN 'KW' THEN '965'
      WHEN 'KG' THEN '996'
      WHEN 'LA' THEN '856'
      WHEN 'LB' THEN '961'
      WHEN 'LS' THEN '266'
      WHEN 'LV' THEN '371'
      WHEN 'LR' THEN '231'
      WHEN 'LY' THEN '218'
      WHEN 'LI' THEN '423'
      WHEN 'LT' THEN '370'
      WHEN 'LU' THEN '352'
      WHEN 'MO' THEN '853'
      WHEN 'MG' THEN '261'
      WHEN 'MW' THEN '265'
      WHEN 'MY' THEN '60'
      WHEN 'MV' THEN '960'
      WHEN 'ML' THEN '223'
      WHEN 'MT' THEN '356'
      WHEN 'MQ' THEN '596'
      WHEN 'MR' THEN '222'
      WHEN 'MU' THEN '230'
      WHEN 'MX' THEN '52'
      WHEN 'MC' THEN '377'
      WHEN 'MN' THEN '976'
      WHEN 'MD' THEN '373'
      WHEN 'ME' THEN '382'
      WHEN 'MS' THEN '1 664'
      WHEN 'MA' THEN '212'
      WHEN 'MZ' THEN '258'
      WHEN 'OM' THEN '968'
      WHEN 'NA' THEN '264'
      WHEN 'NR' THEN '674'
      WHEN 'NP' THEN '977'
      WHEN 'NL' THEN '31'
      WHEN 'CW' THEN '599'
      WHEN 'AW' THEN '297'
      WHEN 'SX' THEN '1 721'
      WHEN 'BQ' THEN '599'
      WHEN 'NC' THEN '687'
      WHEN 'VU' THEN '678'
      WHEN 'NZ' THEN '64'
      WHEN 'NI' THEN '505'
      WHEN 'NE' THEN '227'
      WHEN 'NG' THEN '234'
      WHEN 'NU' THEN '683'
      WHEN 'NF' THEN '672'
      WHEN 'NO' THEN '47'
      WHEN 'MP' THEN '1 670'
      WHEN 'UM' THEN '268'
      WHEN 'FM' THEN '691'
      WHEN 'MH' THEN '692'
      WHEN 'PW' THEN '680'
      WHEN 'PK' THEN '92'
      WHEN 'PA' THEN '507'
      WHEN 'PG' THEN '675'
      WHEN 'PY' THEN '595'
      WHEN 'PE' THEN '51'
      WHEN 'PH' THEN '63'
      WHEN 'PN' THEN '870'
      WHEN 'PL' THEN '48'
      WHEN 'PT' THEN '351'
      WHEN 'GW' THEN '245'
      WHEN 'TL' THEN '670'
      WHEN 'PR' THEN '1'
      WHEN 'QA' THEN '974'
      WHEN 'RE' THEN '262'
      WHEN 'RO' THEN '40'
      WHEN 'RU' THEN '7'
      WHEN 'RW' THEN '250'
      WHEN 'BL' THEN '590'
      WHEN 'KN' THEN '1 869'
      WHEN 'AI' THEN '1 264'
      WHEN 'LC' THEN '1 758'
      WHEN 'MF' THEN '1 599'
      WHEN 'PM' THEN '508'
      WHEN 'VC' THEN '1 784'
      WHEN 'SM' THEN '378'
      WHEN 'ST' THEN '239'
      WHEN 'SA' THEN '966'
      WHEN 'SN' THEN '221'
      WHEN 'RS' THEN '381'
      WHEN 'SC' THEN '248'
      WHEN 'SL' THEN '232'
      WHEN 'SG' THEN '65'
      WHEN 'SK' THEN '421'
      WHEN 'VN' THEN '84'
      WHEN 'SI' THEN '386'
      WHEN 'SO' THEN '252'
      WHEN 'ZA' THEN '27'
      WHEN 'ZW' THEN '263'
      WHEN 'ES' THEN '34'
      WHEN 'SS' THEN '211'
      WHEN 'SD' THEN '249'
      WHEN 'EH' THEN '21228'
      WHEN 'SR' THEN '597'
      WHEN 'SJ' THEN '4779'
      WHEN 'SZ' THEN '268'
      WHEN 'SE' THEN '46'
      WHEN 'CH' THEN '41'
      WHEN 'SY' THEN '963'
      WHEN 'TJ' THEN '992'
      WHEN 'TH' THEN '66'
      WHEN 'TG' THEN '228'
      WHEN 'TK' THEN '690'
      WHEN 'TO' THEN '676'
      WHEN 'TT' THEN '1 868'
      WHEN 'AE' THEN '971'
      WHEN 'TN' THEN '216'
      WHEN 'TR' THEN '90'
      WHEN 'TM' THEN '993'
      WHEN 'TC' THEN '1 649'
      WHEN 'TV' THEN '688'
      WHEN 'UG' THEN '256'
      WHEN 'UA' THEN '380'
      WHEN 'MK' THEN '389'
      WHEN 'EG' THEN '20'
      WHEN 'GB' THEN '44'
      WHEN 'GG' THEN '44'
      WHEN 'JE' THEN '44'
      WHEN 'IM' THEN '44'
      WHEN 'TZ' THEN '255'
      WHEN 'US' THEN '1'
      WHEN 'VI' THEN '1 340'
      WHEN 'BF' THEN '226'
      WHEN 'UY' THEN '598'
      WHEN 'UZ' THEN '998'
      WHEN 'VE' THEN '58'
      WHEN 'WF' THEN '681'
      WHEN 'WS' THEN '685'
      WHEN 'YE' THEN '967'
      WHEN 'ZM' THEN '260'
      ELSE indicativo
    END
    WHERE alfa2 IN (
      'AF',
      'AL',
      'AQ',
      'DZ',
      'AS',
      'AD',
      'AO',
      'AG',
      'AZ',
      'AR',
      'AU',
      'AT',
      'BS',
      'BH',
      'BD',
      'AM',
      'BB',
      'BE',
      'BM',
      'BT',
      'BO',
      'BA',
      'BW',
      'BV',
      'BR',
      'BZ',
      'IO',
      'SB',
      'VG',
      'BN',
      'BG',
      'MM',
      'BI',
      'BY',
      'KH',
      'CM',
      'CA',
      'CV',
      'KY',
      'CF',
      'LK',
      'TD',
      'CL',
      'CN',
      'TW',
      'CX',
      'CC',
      'CO',
      'KM',
      'YT',
      'CG',
      'CD',
      'CK',
      'CR',
      'HR',
      'CU',
      'CY',
      'CZ',
      'BJ',
      'DK',
      'DM',
      'DO',
      'EC',
      'SV',
      'GQ',
      'ET',
      'ER',
      'EE',
      'FO',
      'FK',
      'GS',
      'FJ',
      'FI',
      'AX',
      'FR',
      'GF',
      'PF',
      'TF',
      'DJ',
      'GA',
      'GE',
      'GM',
      'PS',
      'DE',
      'GH',
      'GI',
      'KI',
      'GR',
      'GL',
      'GD',
      'GP',
      'GU',
      'GT',
      'GN',
      'GY',
      'HT',
      'VA',
      'HN',
      'HK',
      'HU',
      'IS',
      'IN',
      'ID',
      'IR',
      'IQ',
      'IE',
      'IL',
      'IT',
      'CI',
      'JM',
      'JP',
      'KZ',
      'JO',
      'KE',
      'KP',
      'KR',
      'KW',
      'KG',
      'LA',
      'LB',
      'LS',
      'LV',
      'LR',
      'LY',
      'LI',
      'LT',
      'LU',
      'MO',
      'MG',
      'MW',
      'MY',
      'MV',
      'ML',
      'MT',
      'MQ',
      'MR',
      'MU',
      'MX',
      'MC',
      'MN',
      'MD',
      'ME',
      'MS',
      'MA',
      'MZ',
      'OM',
      'NA',
      'NR',
      'NP',
      'NL',
      'CW',
      'AW',
      'SX',
      'BQ',
      'NC',
      'VU',
      'NZ',
      'NI',
      'NE',
      'NG',
      'NU',
      'NF',
      'NO',
      'MP',
      'UM',
      'FM',
      'MH',
      'PW',
      'PK',
      'PA',
      'PG',
      'PY',
      'PE',
      'PH',
      'PN',
      'PL',
      'PT',
      'GW',
      'TL',
      'PR',
      'QA',
      'RE',
      'RO',
      'RU',
      'RW',
      'BL',
      'KN',
      'AI',
      'LC',
      'MF',
      'PM',
      'VC',
      'SM',
      'ST',
      'SA',
      'SN',
      'RS',
      'SC',
      'SL',
      'SG',
      'SK',
      'VN',
      'SI',
      'SO',
      'ZA',
      'ZW',
      'ES',
      'SS',
      'SD',
      'EH',
      'SR',
      'SJ',
      'SZ',
      'SE',
      'CH',
      'SY',
      'TJ',
      'TH',
      'TG',
      'TK',
      'TO',
      'TT',
      'AE',
      'TN',
      'TR',
      'TM',
      'TC',
      'TV',
      'UG',
      'UA',
      'MK',
      'EG',
      'GB',
      'GG',
      'JE',
      'IM',
      'TZ',
      'US',
      'VI',
      'BF',
      'UY',
      'UZ',
      'VE',
      'WF',
      'WS',
      'YE',
      'ZM'
    )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE msip_pais SET indicativo = NULL
    WHERE alfa2 IN (
      'AF',
      'AL',
      'AQ',
      'DZ',
      'AS',
      'AD',
      'AO',
      'AG',
      'AZ',
      'AR',
      'AU',
      'AT',
      'BS',
      'BH',
      'BD',
      'AM',
      'BB',
      'BE',
      'BM',
      'BT',
      'BO',
      'BA',
      'BW',
      'BV',
      'BR',
      'BZ',
      'IO',
      'SB',
      'VG',
      'BN',
      'BG',
      'MM',
      'BI',
      'BY',
      'KH',
      'CM',
      'CA',
      'CV',
      'KY',
      'CF',
      'LK',
      'TD',
      'CL',
      'CN',
      'TW',
      'CX',
      'CC',
      'CO',
      'KM',
      'YT',
      'CG',
      'CD',
      'CK',
      'CR',
      'HR',
      'CU',
      'CY',
      'CZ',
      'BJ',
      'DK',
      'DM',
      'DO',
      'EC',
      'SV',
      'GQ',
      'ET',
      'ER',
      'EE',
      'FO',
      'FK',
      'GS',
      'FJ',
      'FI',
      'AX',
      'FR',
      'GF',
      'PF',
      'TF',
      'DJ',
      'GA',
      'GE',
      'GM',
      'PS',
      'DE',
      'GH',
      'GI',
      'KI',
      'GR',
      'GL',
      'GD',
      'GP',
      'GU',
      'GT',
      'GN',
      'GY',
      'HT',
      'VA',
      'HN',
      'HK',
      'HU',
      'IS',
      'IN',
      'ID',
      'IR',
      'IQ',
      'IE',
      'IL',
      'IT',
      'CI',
      'JM',
      'JP',
      'KZ',
      'JO',
      'KE',
      'KP',
      'KR',
      'KW',
      'KG',
      'LA',
      'LB',
      'LS',
      'LV',
      'LR',
      'LY',
      'LI',
      'LT',
      'LU',
      'MO',
      'MG',
      'MW',
      'MY',
      'MV',
      'ML',
      'MT',
      'MQ',
      'MR',
      'MU',
      'MX',
      'MC',
      'MN',
      'MD',
      'ME',
      'MS',
      'MA',
      'MZ',
      'OM',
      'NA',
      'NR',
      'NP',
      'NL',
      'CW',
      'AW',
      'SX',
      'BQ',
      'NC',
      'VU',
      'NZ',
      'NI',
      'NE',
      'NG',
      'NU',
      'NF',
      'NO',
      'MP',
      'UM',
      'FM',
      'MH',
      'PW',
      'PK',
      'PA',
      'PG',
      'PY',
      'PE',
      'PH',
      'PN',
      'PL',
      'PT',
      'GW',
      'TL',
      'PR',
      'QA',
      'RE',
      'RO',
      'RU',
      'RW',
      'BL',
      'KN',
      'AI',
      'LC',
      'MF',
      'PM',
      'VC',
      'SM',
      'ST',
      'SA',
      'SN',
      'RS',
      'SC',
      'SL',
      'SG',
      'SK',
      'VN',
      'SI',
      'SO',
      'ZA',
      'ZW',
      'ES',
      'SS',
      'SD',
      'EH',
      'SR',
      'SJ',
      'SZ',
      'SE',
      'CH',
      'SY',
      'TJ',
      'TH',
      'TG',
      'TK',
      'TO',
      'TT',
      'AE',
      'TN',
      'TR',
      'TM',
      'TC',
      'TV',
      'UG',
      'UA',
      'MK',
      'EG',
      'GB',
      'GG',
      'JE',
      'IM',
      'TZ',
      'US',
      'VI',
      'BF',
      'UY',
      'UZ',
      'VE',
      'WF',
      'WS',
      'YE',
      'ZM'
    )
  `.execute(db)
}
