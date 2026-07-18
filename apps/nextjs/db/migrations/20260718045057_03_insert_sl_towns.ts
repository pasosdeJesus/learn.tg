import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    INSERT INTO msip_centropoblado (nombre, municipio_id, latitud, longitud, fechacreacion, created_at, updated_at)
    SELECT
      t.town,
      m.id,
      t.lat,
      t.lon,
      NOW(),
      NOW(),
      NOW()
    FROM (
      SELECT 'Baiwalla' AS town, 'Dea' AS chiefdom, 'Kailahun' AS district, 7.98039328 AS lat, -10.63604148 AS lon
      UNION ALL
      SELECT 'Dodo' AS town, 'Dea' AS chiefdom, 'Kailahun' AS district, 7.9486324 AS lat, -10.67087367 AS lon
      UNION ALL
      SELECT 'Sakiema' AS town, 'Dea' AS chiefdom, 'Kailahun' AS district, 8.00757173 AS lat, -10.68176221 AS lon
      UNION ALL
      SELECT 'Sienga' AS town, 'Dea' AS chiefdom, 'Kailahun' AS district, 7.91063203 AS lat, -10.63879056 AS lon
      UNION ALL
      SELECT 'Bobor' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.9203002 AS lat, -10.90929788 AS lon
      UNION ALL
      SELECT 'Kaio' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.94538913 AS lat, -10.86766264 AS lon
      UNION ALL
      SELECT 'Lower Giebu' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.82206797 AS lat, -10.90731483 AS lon
      UNION ALL
      SELECT 'Lower Luyengeh' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.84690333 AS lat, -10.99588921 AS lon
      UNION ALL
      SELECT 'Mano' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.91109369 AS lat, -10.84265768 AS lon
      UNION ALL
      SELECT 'Sowa' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.98301261 AS lat, -10.82294552 AS lon
      UNION ALL
      SELECT 'Upper Giebu' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.86267628 AS lat, -10.89365132 AS lon
      UNION ALL
      SELECT 'Upper Luyengeh' AS town, 'Jawie' AS chiefdom, 'Kailahun' AS district, 7.8622429 AS lat, -10.95031394 AS lon
      UNION ALL
      SELECT 'Dakaleley' AS town, 'Kissi Kama' AS chiefdom, 'Kailahun' AS district, 8.46483866 AS lat, -10.37693348 AS lon
      UNION ALL
      SELECT 'Kama Teng' AS town, 'Kissi Kama' AS chiefdom, 'Kailahun' AS district, 8.40958283 AS lat, -10.40377859 AS lon
      UNION ALL
      SELECT 'Kama Toh' AS town, 'Kissi Kama' AS chiefdom, 'Kailahun' AS district, 8.36873317 AS lat, -10.42165224 AS lon
      UNION ALL
      SELECT 'Bumasadu' AS town, 'Kissi Teng' AS chiefdom, 'Kailahun' AS district, 8.34304419 AS lat, -10.37665553 AS lon
      UNION ALL
      SELECT 'Konio' AS town, 'Kissi Teng' AS chiefdom, 'Kailahun' AS district, 8.46539895 AS lat, -10.3163184 AS lon
      UNION ALL
      SELECT 'Kundu' AS town, 'Kissi Teng' AS chiefdom, 'Kailahun' AS district, 8.46476732 AS lat, -10.29710068 AS lon
      UNION ALL
      SELECT 'Lela' AS town, 'Kissi Teng' AS chiefdom, 'Kailahun' AS district, 8.37472169 AS lat, -10.37853232 AS lon
      UNION ALL
      SELECT 'Torli' AS town, 'Kissi Teng' AS chiefdom, 'Kailahun' AS district, 8.4610302 AS lat, -10.34350208 AS lon
      UNION ALL
      SELECT 'Bende Bengu' AS town, 'Kissi Tongi' AS chiefdom, 'Kailahun' AS district, 8.39268673 AS lat, -10.29981306 AS lon
      UNION ALL
      SELECT 'Konio' AS town, 'Kissi Tongi' AS chiefdom, 'Kailahun' AS district, 8.36306663 AS lat, -10.33454414 AS lon
      UNION ALL
      SELECT 'Pokorli' AS town, 'Kissi Tongi' AS chiefdom, 'Kailahun' AS district, 8.32635813 AS lat, -10.31627093 AS lon
      UNION ALL
      SELECT 'Tongi Tingi' AS town, 'Kissi Tongi' AS chiefdom, 'Kailahun' AS district, 8.21223903 AS lat, -10.35868993 AS lon
      UNION ALL
      SELECT 'Bongre' AS town, 'Kpeje Bongre' AS chiefdom, 'Kailahun' AS district, 8.06516359 AS lat, -10.80036156 AS lon
      UNION ALL
      SELECT 'Borkou' AS town, 'Kpeje Bongre' AS chiefdom, 'Kailahun' AS district, 8.17566274 AS lat, -10.73236756 AS lon
      UNION ALL
      SELECT 'Falloh' AS town, 'Kpeje Bongre' AS chiefdom, 'Kailahun' AS district, 8.17644019 AS lat, -10.7859282 AS lon
      UNION ALL
      SELECT 'Jorwu' AS town, 'Kpeje Bongre' AS chiefdom, 'Kailahun' AS district, 8.09872595 AS lat, -10.84327356 AS lon
      UNION ALL
      SELECT 'Manowa' AS town, 'Kpeje Bongre' AS chiefdom, 'Kailahun' AS district, 8.17907908 AS lat, -10.7471824 AS lon
      UNION ALL
      SELECT 'Marwei' AS town, 'Kpeje Bongre' AS chiefdom, 'Kailahun' AS district, 8.11871211 AS lat, -10.77932462 AS lon
      UNION ALL
      SELECT 'Seimaya' AS town, 'Kpeje Bongre' AS chiefdom, 'Kailahun' AS district, 8.22754735 AS lat, -10.72227592 AS lon
      UNION ALL
      SELECT 'Bunumbu' AS town, 'Kpeje West' AS chiefdom, 'Kailahun' AS district, 8.16751234 AS lat, -10.85011239 AS lon
      UNION ALL
      SELECT 'Golama' AS town, 'Kpeje West' AS chiefdom, 'Kailahun' AS district, 8.22911594 AS lat, -10.79402145 AS lon
      UNION ALL
      SELECT 'Kpaewa' AS town, 'Kpeje West' AS chiefdom, 'Kailahun' AS district, 8.21979075 AS lat, -10.85194553 AS lon
      UNION ALL
      SELECT 'Kpindima' AS town, 'Kpeje West' AS chiefdom, 'Kailahun' AS district, 8.13771103 AS lat, -10.82678469 AS lon
      UNION ALL
      SELECT 'Baoma' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.27653263 AS lat, -10.6605757 AS lon
      UNION ALL
      SELECT 'Gao' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.09728842 AS lat, -10.58160782 AS lon
      UNION ALL
      SELECT 'Gbela' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.26474254 AS lat, -10.45824001 AS lon
      UNION ALL
      SELECT 'Giehun' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.19781293 AS lat, -10.63511897 AS lon
      UNION ALL
      SELECT 'Lower Kpombali' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.17480962 AS lat, -10.55922064 AS lon
      UNION ALL
      SELECT 'Luawa Foguiya' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.24656848 AS lat, -10.56757575 AS lon
      UNION ALL
      SELECT 'Mano-Sewallu' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.33658552 AS lat, -10.4754342 AS lon
      UNION ALL
      SELECT 'Mende Buima' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.19965892 AS lat, -10.69004423 AS lon
      UNION ALL
      SELECT 'Mofindor' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.31683029 AS lat, -10.61862897 AS lon
      UNION ALL
      SELECT 'Upper Kpombali' AS town, 'Luawa' AS chiefdom, 'Kailahun' AS district, 8.19780805 AS lat, -10.48228715 AS lon
      UNION ALL
      SELECT 'Bamburu' AS town, 'Malema' AS chiefdom, 'Kailahun' AS district, 7.79516764 AS lat, -10.67267945 AS lon
      UNION ALL
      SELECT 'Lower Sami' AS town, 'Malema' AS chiefdom, 'Kailahun' AS district, 7.73824062 AS lat, -10.87731136 AS lon
      UNION ALL
      SELECT 'Njagbla' AS town, 'Malema' AS chiefdom, 'Kailahun' AS district, 7.88924713 AS lat, -10.74166813 AS lon
      UNION ALL
      SELECT 'Pelegbambeima' AS town, 'Malema' AS chiefdom, 'Kailahun' AS district, 7.74467174 AS lat, -10.80300338 AS lon
      UNION ALL
      SELECT 'Upper Sami' AS town, 'Malema' AS chiefdom, 'Kailahun' AS district, 7.88872135 AS lat, -10.79609763 AS lon
      UNION ALL
      SELECT 'Gbongre' AS town, 'Mandu' AS chiefdom, 'Kailahun' AS district, 8.04444464 AS lat, -10.77627653 AS lon
      UNION ALL
      SELECT 'Levuma Jeigbla' AS town, 'Mandu' AS chiefdom, 'Kailahun' AS district, 8.04150964 AS lat, -10.73322908 AS lon
      UNION ALL
      SELECT 'Lower Kuiva' AS town, 'Mandu' AS chiefdom, 'Kailahun' AS district, 7.92704394 AS lat, -10.7881914 AS lon
      UNION ALL
      SELECT 'Upper Kuiva' AS town, 'Mandu' AS chiefdom, 'Kailahun' AS district, 7.94794155 AS lat, -10.71878913 AS lon
      UNION ALL
      SELECT 'Bombowa' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 8.11409592 AS lat, -10.90953507 AS lon
      UNION ALL
      SELECT 'Dan Sei' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 8.02910427 AS lat, -10.89307753 AS lon
      UNION ALL
      SELECT 'Falley' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 8.06121098 AS lat, -10.87966627 AS lon
      UNION ALL
      SELECT 'Fauya' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 7.90839254 AS lat, -11.00351959 AS lon
      UNION ALL
      SELECT 'Gboo' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 8.03704659 AS lat, -10.93502961 AS lon
      UNION ALL
      SELECT 'Jonga' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 8.0407185 AS lat, -10.83113317 AS lon
      UNION ALL
      SELECT 'Kargbu' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 7.93283171 AS lat, -10.95713281 AS lon
      UNION ALL
      SELECT 'Keimaya' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 7.96752826 AS lat, -10.91045809 AS lon
      UNION ALL
      SELECT 'Lower Nyawa' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 7.96434103 AS lat, -10.98389236 AS lon
      UNION ALL
      SELECT 'Sei I' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 8.00820533 AS lat, -10.95520104 AS lon
      UNION ALL
      SELECT 'Sei II' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 8.06887822 AS lat, -10.93744039 AS lon
      UNION ALL
      SELECT 'Upper Nyawa' AS town, 'Njaluahun' AS chiefdom, 'Kailahun' AS district, 7.98868837 AS lat, -10.86834439 AS lon
      UNION ALL
      SELECT 'Bulima' AS town, 'Penguia' AS chiefdom, 'Kailahun' AS district, 8.28717624 AS lat, -10.73253113 AS lon
      UNION ALL
      SELECT 'Jagor' AS town, 'Penguia' AS chiefdom, 'Kailahun' AS district, 8.42340768 AS lat, -10.65397422 AS lon
      UNION ALL
      SELECT 'Kumatandu' AS town, 'Penguia' AS chiefdom, 'Kailahun' AS district, 8.35497464 AS lat, -10.70001553 AS lon
      UNION ALL
      SELECT 'Lombama' AS town, 'Penguia' AS chiefdom, 'Kailahun' AS district, 8.420033 AS lat, -10.68422042 AS lon
      UNION ALL
      SELECT 'Nimima' AS town, 'Penguia' AS chiefdom, 'Kailahun' AS district, 8.37623047 AS lat, -10.74179869 AS lon
      UNION ALL
      SELECT 'Bambara' AS town, 'Upper Bambara' AS chiefdom, 'Kailahun' AS district, 8.05835544 AS lat, -10.65586042 AS lon
      UNION ALL
      SELECT 'Bomaru-guma' AS town, 'Upper Bambara' AS chiefdom, 'Kailahun' AS district, 8.02272915 AS lat, -10.63012805 AS lon
      UNION ALL
      SELECT 'Goleiwoma' AS town, 'Upper Bambara' AS chiefdom, 'Kailahun' AS district, 8.12663923 AS lat, -10.72811193 AS lon
      UNION ALL
      SELECT 'Golu' AS town, 'Upper Bambara' AS chiefdom, 'Kailahun' AS district, 8.10753848 AS lat, -10.64045362 AS lon
      UNION ALL
      SELECT 'Korbu' AS town, 'Upper Bambara' AS chiefdom, 'Kailahun' AS district, 8.07887984 AS lat, -10.70995515 AS lon
      UNION ALL
      SELECT 'Naiahun' AS town, 'Upper Bambara' AS chiefdom, 'Kailahun' AS district, 8.13043386 AS lat, -10.67991569 AS lon
      UNION ALL
      SELECT 'Bendu' AS town, 'Yawei' AS chiefdom, 'Kailahun' AS district, 8.32428067 AS lat, -10.79236817 AS lon
      UNION ALL
      SELECT 'Kuiva Buima' AS town, 'Yawei' AS chiefdom, 'Kailahun' AS district, 8.26277316 AS lat, -10.80471309 AS lon
      UNION ALL
      SELECT 'Kuiva Jagor' AS town, 'Yawei' AS chiefdom, 'Kailahun' AS district, 8.35787253 AS lat, -10.83043515 AS lon
      UNION ALL
      SELECT 'Kuivawa' AS town, 'Yawei' AS chiefdom, 'Kailahun' AS district, 8.32675622 AS lat, -10.85368334 AS lon
      UNION ALL
      SELECT 'Dakowa' AS town, 'Dama' AS chiefdom, 'Kenema' AS district, 7.76457121 AS lat, -11.10388829 AS lon
      UNION ALL
      SELECT 'Danyadejo' AS town, 'Dama' AS chiefdom, 'Kenema' AS district, 7.76457121 AS lat, -11.15508842 AS lon
      UNION ALL
      SELECT 'Dassama' AS town, 'Dama' AS chiefdom, 'Kenema' AS district, 7.83946937 AS lat, -11.10438489 AS lon
      UNION ALL
      SELECT 'Fowai' AS town, 'Dama' AS chiefdom, 'Kenema' AS district, 7.74079979 AS lat, -11.1962585 AS lon
      UNION ALL
      SELECT 'Klajie' AS town, 'Dama' AS chiefdom, 'Kenema' AS district, 7.81173667 AS lat, -11.07427897 AS lon
      UNION ALL
      SELECT 'Lower Dabor' AS town, 'Dama' AS chiefdom, 'Kenema' AS district, 7.68292382 AS lat, -11.21236267 AS lon
      UNION ALL
      SELECT 'Upper Dabor' AS town, 'Dama' AS chiefdom, 'Kenema' AS district, 7.83679627 AS lat, -11.02502301 AS lon
      UNION ALL
      SELECT 'Bambara' AS town, 'Dodo' AS chiefdom, 'Kenema' AS district, 8.22380235 AS lat, -11.19949568 AS lon
      UNION ALL
      SELECT 'Bonya' AS town, 'Dodo' AS chiefdom, 'Kenema' AS district, 8.16819122 AS lat, -11.16216025 AS lon
      UNION ALL
      SELECT 'Bundoryama' AS town, 'Dodo' AS chiefdom, 'Kenema' AS district, 8.20492921 AS lat, -11.23179056 AS lon
      UNION ALL
      SELECT 'Gorama' AS town, 'Dodo' AS chiefdom, 'Kenema' AS district, 8.31218755 AS lat, -11.20648664 AS lon
      UNION ALL
      SELECT 'Karteh' AS town, 'Dodo' AS chiefdom, 'Kenema' AS district, 8.24820796 AS lat, -11.16668691 AS lon
      UNION ALL
      SELECT 'Korgay' AS town, 'Dodo' AS chiefdom, 'Kenema' AS district, 8.09351655 AS lat, -11.22332865 AS lon
      UNION ALL
      SELECT 'Seiwor' AS town, 'Dodo' AS chiefdom, 'Kenema' AS district, 8.12280724 AS lat, -11.18950364 AS lon
      UNION ALL
      SELECT 'Giebu' AS town, 'Gaura' AS chiefdom, 'Kenema' AS district, 7.66588783 AS lat, -11.12998863 AS lon
      UNION ALL
      SELECT 'Joru' AS town, 'Gaura' AS chiefdom, 'Kenema' AS district, 7.6748927 AS lat, -11.03410075 AS lon
      UNION ALL
      SELECT 'Kokoru' AS town, 'Gaura' AS chiefdom, 'Kenema' AS district, 7.63958016 AS lat, -11.10143166 AS lon
      UNION ALL
      SELECT 'Mendekelema' AS town, 'Gaura' AS chiefdom, 'Kenema' AS district, 7.77938829 AS lat, -10.97101714 AS lon
      UNION ALL
      SELECT 'Sandaru' AS town, 'Gaura' AS chiefdom, 'Kenema' AS district, 7.7536592 AS lat, -11.03032265 AS lon
      UNION ALL
      SELECT 'Sembehun' AS town, 'Gaura' AS chiefdom, 'Kenema' AS district, 7.68394632 AS lat, -10.96336736 AS lon
      UNION ALL
      SELECT 'Biatong' AS town, 'Gorama Mende' AS chiefdom, 'Kenema' AS district, 8.49247771 AS lat, -11.40568411 AS lon
      UNION ALL
      SELECT 'Famanjo' AS town, 'Gorama Mende' AS chiefdom, 'Kenema' AS district, 8.44729003 AS lat, -11.27909426 AS lon
      UNION ALL
      SELECT 'Kaklawa' AS town, 'Gorama Mende' AS chiefdom, 'Kenema' AS district, 8.41764239 AS lat, -11.3842286 AS lon
      UNION ALL
      SELECT 'Kualley' AS town, 'Gorama Mende' AS chiefdom, 'Kenema' AS district, 8.43173879 AS lat, -11.49328312 AS lon
      UNION ALL
      SELECT 'Borley' AS town, 'Kandu Leppiama' AS chiefdom, 'Kenema' AS district, 7.99832528 AS lat, -11.35657583 AS lon
      UNION ALL
      SELECT 'Gboro-Lokoma' AS town, 'Kandu Leppiama' AS chiefdom, 'Kenema' AS district, 8.07236266 AS lat, -11.30150488 AS lon
      UNION ALL
      SELECT 'Karga' AS town, 'Kandu Leppiama' AS chiefdom, 'Kenema' AS district, 7.98612383 AS lat, -11.32140378 AS lon
      UNION ALL
      SELECT 'Sonnie' AS town, 'Kandu Leppiama' AS chiefdom, 'Kenema' AS district, 8.01591104 AS lat, -11.25587423 AS lon
      UNION ALL
      SELECT 'Joi' AS town, 'Koya' AS chiefdom, 'Kenema' AS district, 7.71085145 AS lat, -11.27467054 AS lon
      UNION ALL
      SELECT 'Koya Gbundohun' AS town, 'Koya' AS chiefdom, 'Kenema' AS district, 7.53175402 AS lat, -11.3047023 AS lon
      UNION ALL
      SELECT 'Menima' AS town, 'Koya' AS chiefdom, 'Kenema' AS district, 7.68844372 AS lat, -11.30935649 AS lon
      UNION ALL
      SELECT 'Serabu' AS town, 'Koya' AS chiefdom, 'Kenema' AS district, 7.62738512 AS lat, -11.34437508 AS lon
      UNION ALL
      SELECT 'Upper Koya' AS town, 'Koya' AS chiefdom, 'Kenema' AS district, 7.60646903 AS lat, -11.26044867 AS lon
      UNION ALL
      SELECT 'Korjei' AS town, 'Langrama' AS chiefdom, 'Kenema' AS district, 7.65942287 AS lat, -11.45806774 AS lon
      UNION ALL
      SELECT 'Njeiwoma' AS town, 'Langrama' AS chiefdom, 'Kenema' AS district, 7.67461161 AS lat, -11.48133818 AS lon
      UNION ALL
      SELECT 'Bonya' AS town, 'Lower Bambara' AS chiefdom, 'Kenema' AS district, 8.27139837 AS lat, -11.10193036 AS lon
      UNION ALL
      SELECT 'Fallay' AS town, 'Lower Bambara' AS chiefdom, 'Kenema' AS district, 8.17101794 AS lat, -11.02032963 AS lon
      UNION ALL
      SELECT 'Gboro' AS town, 'Lower Bambara' AS chiefdom, 'Kenema' AS district, 8.10765455 AS lat, -11.01848962 AS lon
      UNION ALL
      SELECT 'Korjei Buima' AS town, 'Lower Bambara' AS chiefdom, 'Kenema' AS district, 8.10668645 AS lat, -11.06495467 AS lon
      UNION ALL
      SELECT 'Korjei Ngieya' AS town, 'Lower Bambara' AS chiefdom, 'Kenema' AS district, 8.11617286 AS lat, -11.11799917 AS lon
      UNION ALL
      SELECT 'Nyawa' AS town, 'Lower Bambara' AS chiefdom, 'Kenema' AS district, 8.23148181 AS lat, -11.05216507 AS lon
      UNION ALL
      SELECT 'Sei' AS town, 'Lower Bambara' AS chiefdom, 'Kenema' AS district, 8.23644028 AS lat, -10.97025046 AS lon
      UNION ALL
      SELECT 'Hulorhun Njagbudor' AS town, 'Malegohun' AS chiefdom, 'Kenema' AS district, 8.17211802 AS lat, -10.91149754 AS lon
      UNION ALL
      SELECT 'Hulorhun Njeigor' AS town, 'Malegohun' AS chiefdom, 'Kenema' AS district, 8.21192404 AS lat, -10.91011502 AS lon
      UNION ALL
      SELECT 'Konjo Buiima' AS town, 'Malegohun' AS chiefdom, 'Kenema' AS district, 8.26246469 AS lat, -10.8993535 AS lon
      UNION ALL
      SELECT 'Konjo Njeigor' AS town, 'Malegohun' AS chiefdom, 'Kenema' AS district, 8.36650242 AS lat, -10.89947964 AS lon
      UNION ALL
      SELECT 'Konjo Yematanga' AS town, 'Malegohun' AS chiefdom, 'Kenema' AS district, 8.31792407 AS lat, -10.91901235 AS lon
      UNION ALL
      SELECT 'Lower Torgboma' AS town, 'Malegohun' AS chiefdom, 'Kenema' AS district, 8.10089924 AS lat, -10.97288311 AS lon
      UNION ALL
      SELECT 'Upper Torgboma' AS town, 'Malegohun' AS chiefdom, 'Kenema' AS district, 8.13082765 AS lat, -10.95017803 AS lon
      UNION ALL
      SELECT 'Bandawor' AS town, 'Niawa' AS chiefdom, 'Kenema' AS district, 7.75590392 AS lat, -11.3533639 AS lon
      UNION ALL
      SELECT 'Kpatawa' AS town, 'Niawa' AS chiefdom, 'Kenema' AS district, 7.56807083 AS lat, -11.47403202 AS lon
      UNION ALL
      SELECT 'Mabondor' AS town, 'Niawa' AS chiefdom, 'Kenema' AS district, 7.61425794 AS lat, -11.44802929 AS lon
      UNION ALL
      SELECT 'Niawa' AS town, 'Niawa' AS chiefdom, 'Kenema' AS district, 7.71511988 AS lat, -11.36690123 AS lon
      UNION ALL
      SELECT 'Vaama' AS town, 'Niawa' AS chiefdom, 'Kenema' AS district, 7.66745089 AS lat, -11.41200769 AS lon
      UNION ALL
      SELECT 'Faama' AS town, 'Nomo' AS chiefdom, 'Kenema' AS district, 7.50467159 AS lat, -10.99385251 AS lon
      UNION ALL
      SELECT 'Ngiebu' AS town, 'Nomo' AS chiefdom, 'Kenema' AS district, 7.58868648 AS lat, -10.97326999 AS lon
      UNION ALL
      SELECT 'Ngiewoma-Njeigor' AS town, 'Nomo' AS chiefdom, 'Kenema' AS district, 7.57116936 AS lat, -10.87972092 AS lon
      UNION ALL
      SELECT 'Dagbanya' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 7.92189416 AS lat, -11.08651154 AS lon
      UNION ALL
      SELECT 'Dakpana' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 8.03184122 AS lat, -11.04469587 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama B' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 7.8591105 AS lat, -11.15650769 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama B' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 7.90934751 AS lat, -11.22338367 AS lon
      UNION ALL
      SELECT 'Kagbado Kamboima' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 7.95102364 AS lat, -11.13283439 AS lon
      UNION ALL
      SELECT 'Kagbado Njeigbla' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 7.90015388 AS lat, -11.05097577 AS lon
      UNION ALL
      SELECT 'Kona Foiya' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 7.9932794 AS lat, -11.02336109 AS lon
      UNION ALL
      SELECT 'Kona Kpindibu' AS town, 'Nongowa' AS chiefdom, 'Kenema' AS district, 8.02998489 AS lat, -11.14402346 AS lon
      UNION ALL
      SELECT 'Bundoryama' AS town, 'Simbaru' AS chiefdom, 'Kenema' AS district, 8.15439366 AS lat, -11.28608523 AS lon
      UNION ALL
      SELECT 'Fallay' AS town, 'Simbaru' AS chiefdom, 'Kenema' AS district, 8.1485357 AS lat, -11.3693258 AS lon
      UNION ALL
      SELECT 'Fonde' AS town, 'Simbaru' AS chiefdom, 'Kenema' AS district, 8.25772818 AS lat, -11.29091795 AS lon
      UNION ALL
      SELECT 'Yalenga' AS town, 'Simbaru' AS chiefdom, 'Kenema' AS district, 8.19519785 AS lat, -11.3415121 AS lon
      UNION ALL
      SELECT 'Fallay' AS town, 'Small Bo' AS chiefdom, 'Kenema' AS district, 7.86671397 AS lat, -11.34834605 AS lon
      UNION ALL
      SELECT 'Gorama' AS town, 'Small Bo' AS chiefdom, 'Kenema' AS district, 7.81096057 AS lat, -11.37812749 AS lon
      UNION ALL
      SELECT 'Kamboma' AS town, 'Small Bo' AS chiefdom, 'Kenema' AS district, 7.82047096 AS lat, -11.28952643 AS lon
      UNION ALL
      SELECT 'Niawa' AS town, 'Small Bo' AS chiefdom, 'Kenema' AS district, 7.92914694 AS lat, -11.32033912 AS lon
      UNION ALL
      SELECT 'Sowa' AS town, 'Small Bo' AS chiefdom, 'Kenema' AS district, 7.86088052 AS lat, -11.42326319 AS lon
      UNION ALL
      SELECT 'Daru' AS town, 'Tunkia' AS chiefdom, 'Kenema' AS district, 7.45432697 AS lat, -11.10328031 AS lon
      UNION ALL
      SELECT 'Gegbwema' AS town, 'Tunkia' AS chiefdom, 'Kenema' AS district, 7.57717845 AS lat, -11.09985897 AS lon
      UNION ALL
      SELECT 'Giewoma' AS town, 'Tunkia' AS chiefdom, 'Kenema' AS district, 7.60247237 AS lat, -11.19766631 AS lon
      UNION ALL
      SELECT 'Gorahun' AS town, 'Tunkia' AS chiefdom, 'Kenema' AS district, 7.44231539 AS lat, -11.25975925 AS lon
      UNION ALL
      SELECT 'Jewahun' AS town, 'Tunkia' AS chiefdom, 'Kenema' AS district, 7.59962847 AS lat, -11.12757654 AS lon
      UNION ALL
      SELECT 'Kuawuma' AS town, 'Tunkia' AS chiefdom, 'Kenema' AS district, 7.52881657 AS lat, -11.10462021 AS lon
      UNION ALL
      SELECT 'Taninahun' AS town, 'Tunkia' AS chiefdom, 'Kenema' AS district, 7.53836076 AS lat, -11.19294442 AS lon
      UNION ALL
      SELECT 'Boryongor' AS town, 'Wandor' AS chiefdom, 'Kenema' AS district, 8.28260999 AS lat, -11.43784768 AS lon
      UNION ALL
      SELECT 'Gbogbeima' AS town, 'Wandor' AS chiefdom, 'Kenema' AS district, 8.33449535 AS lat, -11.2639204 AS lon
      UNION ALL
      SELECT 'Kemoh' AS town, 'Wandor' AS chiefdom, 'Kenema' AS district, 8.35538611 AS lat, -11.32206372 AS lon
      UNION ALL
      SELECT 'Niawa' AS town, 'Wandor' AS chiefdom, 'Kenema' AS district, 8.28363298 AS lat, -11.3226802 AS lon
      UNION ALL
      SELECT 'Songhai' AS town, 'Wandor' AS chiefdom, 'Kenema' AS district, 8.2744942 AS lat, -11.37988389 AS lon
      UNION ALL
      SELECT 'Tongorwa' AS town, 'Wandor' AS chiefdom, 'Kenema' AS district, 8.35006986 AS lat, -11.41102598 AS lon
      UNION ALL
      SELECT 'Airfield' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.89893837 AS lat, -11.17333705 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Bur' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.89342482 AS lat, -11.17056281 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Lum' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.88251144 AS lat, -11.17103211 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-Le' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.89167532 AS lat, -11.18413334 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-Re' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.88362596 AS lat, -11.19469445 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Tec' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.88043528 AS lat, -11.17958522 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Nja' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.87253105 AS lat, -11.18732574 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Kpa' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.87108373 AS lat, -11.17755254 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Kis' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.86140121 AS lat, -11.18018506 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Shi' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.86256991 AS lat, -11.19184624 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-Ny' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.87112032 AS lat, -11.20171951 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-Nd' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.86700375 AS lat, -11.1949068 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-Fo' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.86221366 AS lat, -11.20614573 AS lon
      UNION ALL
      SELECT 'Gbo Kakajama A-Lam' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.854154 AS lat, -11.20167127 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-Go' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.90811099 AS lat, -11.17385295 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-RT' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.91327389 AS lat, -11.17144425 AS lon
      UNION ALL
      SELECT 'Gbo Lambayama A-Ko' AS town, 'Kenema Town' AS chiefdom, 'Kenema' AS district, 7.89893481 AS lat, -11.18113392 AS lon
      UNION ALL
      SELECT 'Dumbia' AS town, 'Fiama' AS chiefdom, 'Kono' AS district, 8.57986847 AS lat, -10.87395653 AS lon
      UNION ALL
      SELECT 'Fiama' AS town, 'Fiama' AS chiefdom, 'Kono' AS district, 8.63524459 AS lat, -10.82334236 AS lon
      UNION ALL
      SELECT 'Kokar' AS town, 'Fiama' AS chiefdom, 'Kono' AS district, 8.59904449 AS lat, -10.80447724 AS lon
      UNION ALL
      SELECT 'Kooma' AS town, 'Fiama' AS chiefdom, 'Kono' AS district, 8.71079269 AS lat, -10.81366827 AS lon
      UNION ALL
      SELECT 'Yorkor' AS town, 'Fiama' AS chiefdom, 'Kono' AS district, 8.65333728 AS lat, -10.88836775 AS lon
      UNION ALL
      SELECT 'Gbane Yemao' AS town, 'Gbane' AS chiefdom, 'Kono' AS district, 8.45748833 AS lat, -10.76051115 AS lon
      UNION ALL
      SELECT 'Gbikidakor' AS town, 'Gbane' AS chiefdom, 'Kono' AS district, 8.51526234 AS lat, -10.89515871 AS lon
      UNION ALL
      SELECT 'Kamara' AS town, 'Gbane' AS chiefdom, 'Kono' AS district, 8.48134005 AS lat, -10.8987113 AS lon
      UNION ALL
      SELECT 'Maikandor' AS town, 'Gbane' AS chiefdom, 'Kono' AS district, 8.54220945 AS lat, -10.82823519 AS lon
      UNION ALL
      SELECT 'Mongo' AS town, 'Gbane' AS chiefdom, 'Kono' AS district, 8.44572256 AS lat, -10.83588087 AS lon
      UNION ALL
      SELECT 'Gbane Kandor' AS town, 'Gbane Kandor' AS chiefdom, 'Kono' AS district, 8.67227083 AS lat, -10.56551463 AS lon
      UNION ALL
      SELECT 'Gbane Kour' AS town, 'Gbane Kandor' AS chiefdom, 'Kono' AS district, 8.57134724 AS lat, -10.59381561 AS lon
      UNION ALL
      SELECT 'Gbane Tetema' AS town, 'Gbane Kandor' AS chiefdom, 'Kono' AS district, 8.61214657 AS lat, -10.58359612 AS lon
      UNION ALL
      SELECT 'Gbendekor' AS town, 'Gbane Kandor' AS chiefdom, 'Kono' AS district, 8.61302675 AS lat, -10.55562533 AS lon
      UNION ALL
      SELECT 'Yanbidu' AS town, 'Gbane Kandor' AS chiefdom, 'Kono' AS district, 8.62235424 AS lat, -10.53372683 AS lon
      UNION ALL
      SELECT 'Banfinfeh' AS town, 'Gbense' AS chiefdom, 'Kono' AS district, 8.77194297 AS lat, -10.87911481 AS lon
      UNION ALL
      SELECT 'Banyafeh' AS town, 'Gbense' AS chiefdom, 'Kono' AS district, 8.71625516 AS lat, -10.92081572 AS lon
      UNION ALL
      SELECT 'Banyakor' AS town, 'Gbense' AS chiefdom, 'Kono' AS district, 8.76834275 AS lat, -10.95811069 AS lon
      UNION ALL
      SELECT 'Moindefeh' AS town, 'Gbense' AS chiefdom, 'Kono' AS district, 8.66759 AS lat, -10.93562878 AS lon
      UNION ALL
      SELECT 'Moindekor' AS town, 'Gbense' AS chiefdom, 'Kono' AS district, 8.68020036 AS lat, -10.98123778 AS lon
      UNION ALL
      SELECT 'Bunabu' AS town, 'Gorama Kono' AS chiefdom, 'Kono' AS district, 8.39407191 AS lat, -11.18545939 AS lon
      UNION ALL
      SELECT 'Kangama' AS town, 'Gorama Kono' AS chiefdom, 'Kono' AS district, 8.38593794 AS lat, -11.06626491 AS lon
      UNION ALL
      SELECT 'Selokoma' AS town, 'Gorama Kono' AS chiefdom, 'Kono' AS district, 8.40225365 AS lat, -10.95989934 AS lon
      UNION ALL
      SELECT 'Dangbaidu' AS town, 'Kamara' AS chiefdom, 'Kono' AS district, 8.72320192 AS lat, -10.97680941 AS lon
      UNION ALL
      SELECT 'Gbondu' AS town, 'Kamara' AS chiefdom, 'Kono' AS district, 8.73859229 AS lat, -11.05777189 AS lon
      UNION ALL
      SELECT 'Kongofinja' AS town, 'Kamara' AS chiefdom, 'Kono' AS district, 8.68541666 AS lat, -11.03301644 AS lon
      UNION ALL
      SELECT 'Sukudu' AS town, 'Kamara' AS chiefdom, 'Kono' AS district, 8.74313586 AS lat, -11.01308302 AS lon
      UNION ALL
      SELECT 'Dia' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.90808288 AS lat, -10.62216042 AS lon
      UNION ALL
      SELECT 'Kamara' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.81325862 AS lat, -10.57589808 AS lon
      UNION ALL
      SELECT 'Kensay' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.76169165 AS lat, -10.56216659 AS lon
      UNION ALL
      SELECT 'Koaro' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.89476014 AS lat, -10.70655542 AS lon
      UNION ALL
      SELECT 'Lei' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.80930236 AS lat, -10.62835835 AS lon
      UNION ALL
      SELECT 'Sangbada' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.7483192 AS lat, -10.64840035 AS lon
      UNION ALL
      SELECT 'Tankoro' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.76789171 AS lat, -10.75074783 AS lon
      UNION ALL
      SELECT 'Tingi-Kor' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.8360726 AS lat, -10.77070498 AS lon
      UNION ALL
      SELECT 'Yawai' AS town, 'Lei' AS chiefdom, 'Kono' AS district, 8.8562982 AS lat, -10.6055429 AS lon
      UNION ALL
      SELECT 'Kamiendor' AS town, 'Mafindor' AS chiefdom, 'Kono' AS district, 8.67377143 AS lat, -10.52236154 AS lon
      UNION ALL
      SELECT 'Kutey' AS town, 'Mafindor' AS chiefdom, 'Kono' AS district, 8.65490337 AS lat, -10.49943577 AS lon
      UNION ALL
      SELECT 'Mafindor' AS town, 'Mafindor' AS chiefdom, 'Kono' AS district, 8.72268375 AS lat, -10.52009484 AS lon
      UNION ALL
      SELECT 'Bafinfeh' AS town, 'Nimikoro' AS chiefdom, 'Kono' AS district, 8.68880663 AS lat, -11.08441583 AS lon
      UNION ALL
      SELECT 'Bandafafeh' AS town, 'Nimikoro' AS chiefdom, 'Kono' AS district, 8.59266144 AS lat, -11.02628439 AS lon
      UNION ALL
      SELECT 'Gbogboafeh' AS town, 'Nimikoro' AS chiefdom, 'Kono' AS district, 8.63170335 AS lat, -11.13116566 AS lon
      UNION ALL
      SELECT 'Jaiama' AS town, 'Nimikoro' AS chiefdom, 'Kono' AS district, 8.53642212 AS lat, -11.10536731 AS lon
      UNION ALL
      SELECT 'Masayiefeh' AS town, 'Nimikoro' AS chiefdom, 'Kono' AS district, 8.45344107 AS lat, -11.06551021 AS lon
      UNION ALL
      SELECT 'Bafinfeh' AS town, 'Nimiyama' AS chiefdom, 'Kono' AS district, 8.65021948 AS lat, -11.22396817 AS lon
      UNION ALL
      SELECT 'Njagbakahun' AS town, 'Nimiyama' AS chiefdom, 'Kono' AS district, 8.56690046 AS lat, -11.30071288 AS lon
      UNION ALL
      SELECT 'Njaifeh' AS town, 'Nimiyama' AS chiefdom, 'Kono' AS district, 8.56208568 AS lat, -11.2337338 AS lon
      UNION ALL
      SELECT 'Peyifeh' AS town, 'Nimiyama' AS chiefdom, 'Kono' AS district, 8.48622126 AS lat, -11.21976211 AS lon
      UNION ALL
      SELECT 'Tama' AS town, 'Nimiyama' AS chiefdom, 'Kono' AS district, 8.64373036 AS lat, -11.30699271 AS lon
      UNION ALL
      SELECT 'Bafinfeh' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.76503835 AS lat, -11.11159326 AS lon
      UNION ALL
      SELECT 'Dangbaidu' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.73263652 AS lat, -11.23076367 AS lon
      UNION ALL
      SELECT 'Fakongofeh' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.86650712 AS lat, -10.84623101 AS lon
      UNION ALL
      SELECT 'Kawafeh' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.97574733 AS lat, -10.97221244 AS lon
      UNION ALL
      SELECT 'Njeikor' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.85073998 AS lat, -10.97650364 AS lon
      UNION ALL
      SELECT 'Samgbafeh' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.88911888 AS lat, -10.92026074 AS lon
      UNION ALL
      SELECT 'Sinkongofeh' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 9.01169349 AS lat, -11.0487504 AS lon
      UNION ALL
      SELECT 'Sumunjifeh' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.94159615 AS lat, -11.06673139 AS lon
      UNION ALL
      SELECT 'Tharma Forest' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.77336237 AS lat, -11.2969574 AS lon
      UNION ALL
      SELECT 'Yawatanda' AS town, 'Sandor' AS chiefdom, 'Kono' AS district, 8.86311647 AS lat, -11.14962929 AS lon
      UNION ALL
      SELECT 'Foidu Mongor' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.5389194 AS lat, -10.6534721 AS lon
      UNION ALL
      SELECT 'Kokongokuma' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.65162479 AS lat, -10.72374177 AS lon
      UNION ALL
      SELECT 'Maindu' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.54995085 AS lat, -10.73468836 AS lon
      UNION ALL
      SELECT 'Mofinkor' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.66471688 AS lat, -10.63856998 AS lon
      UNION ALL
      SELECT 'Sawa Buma' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.50784765 AS lat, -10.74491167 AS lon
      UNION ALL
      SELECT 'Sawa Fiama' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.49629864 AS lat, -10.66884651 AS lon
      UNION ALL
      SELECT 'Tensekor' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.59222179 AS lat, -10.63293106 AS lon
      UNION ALL
      SELECT 'Tensendakor' AS town, 'Soa' AS chiefdom, 'Kono' AS district, 8.56069709 AS lat, -10.62542041 AS lon
      UNION ALL
      SELECT 'Njama' AS town, 'Tankoro' AS chiefdom, 'Kono' AS district, 8.49224215 AS lat, -10.98651623 AS lon
      UNION ALL
      SELECT 'Tankoro' AS town, 'Tankoro' AS chiefdom, 'Kono' AS district, 8.59846195 AS lat, -10.92689921 AS lon
      UNION ALL
      SELECT 'Woafeh' AS town, 'Tankoro' AS chiefdom, 'Kono' AS district, 8.57907099 AS lat, -10.99257601 AS lon
      UNION ALL
      SELECT 'Bawadu' AS town, 'Toli' AS chiefdom, 'Kono' AS district, 8.97196401 AS lat, -10.59750181 AS lon
      UNION ALL
      SELECT 'Komadu' AS town, 'Toli' AS chiefdom, 'Kono' AS district, 8.97762668 AS lat, -10.64712059 AS lon
      UNION ALL
      SELECT 'Kwidu' AS town, 'Toli' AS chiefdom, 'Kono' AS district, 9.02045335 AS lat, -10.62374882 AS lon
      UNION ALL
      SELECT 'Gbense-Sina Town' AS town, 'Koidu Town' AS chiefdom, 'Kono' AS district, 8.65043137 AS lat, -10.97720606 AS lon
      UNION ALL
      SELECT 'Gbense-Moindekor' AS town, 'Koidu Town' AS chiefdom, 'Kono' AS district, 8.64997977 AS lat, -10.96589158 AS lon
      UNION ALL
      SELECT 'Gbense-Moindefeh' AS town, 'Koidu Town' AS chiefdom, 'Kono' AS district, 8.64899549 AS lat, -10.9501099 AS lon
      UNION ALL
      SELECT 'Tankoro-Kinsey' AS town, 'Koidu Town' AS chiefdom, 'Kono' AS district, 8.64563755 AS lat, -10.98543328 AS lon
      UNION ALL
      SELECT 'Tankoro-New Sembeh' AS town, 'Koidu Town' AS chiefdom, 'Kono' AS district, 8.63842584 AS lat, -10.96829587 AS lon
      UNION ALL
      SELECT 'Tankoro-Lebanon' AS town, 'Koidu Town' AS chiefdom, 'Kono' AS district, 8.63627352 AS lat, -10.99267297 AS lon
      UNION ALL
      SELECT 'Tankoro-Kwaquima' AS town, 'Koidu Town' AS chiefdom, 'Kono' AS district, 8.62173022 AS lat, -10.99137064 AS lon
      UNION ALL
      SELECT 'Bumban' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.1466965 AS lat, -11.89697071 AS lon
      UNION ALL
      SELECT 'Bumbandain' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.09851143 AS lat, -11.99624546 AS lon
      UNION ALL
      SELECT 'Kabakeh/Balandugu' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.27826172 AS lat, -11.94111738 AS lon
      UNION ALL
      SELECT 'Kagbankuna' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.44507814 AS lat, -11.91413566 AS lon
      UNION ALL
      SELECT 'Kamabai' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.1034812 AS lat, -11.94763289 AS lon
      UNION ALL
      SELECT 'Karassa' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.34374598 AS lat, -11.84624735 AS lon
      UNION ALL
      SELECT 'Karina' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.22995772 AS lat, -11.98596584 AS lon
      UNION ALL
      SELECT 'Kayonkoro' AS town, 'Biriwa' AS chiefdom, 'Bombali' AS district, 9.24474615 AS lat, -11.90060158 AS lon
      UNION ALL
      SELECT 'Kafala' AS town, 'Bombali Sebora' AS chiefdom, 'Bombali' AS district, 8.77327489 AS lat, -12.14273888 AS lon
      UNION ALL
      SELECT 'Kagbaran Dokom B' AS town, 'Bombali Sebora' AS chiefdom, 'Bombali' AS district, 8.84912489 AS lat, -12.0462177 AS lon
      UNION ALL
      SELECT 'Konta' AS town, 'Bombali Sebora' AS chiefdom, 'Bombali' AS district, 8.75472508 AS lat, -12.02982758 AS lon
      UNION ALL
      SELECT 'Matotoka' AS town, 'Bombali Sebora' AS chiefdom, 'Bombali' AS district, 8.73291895 AS lat, -12.11264967 AS lon
      UNION ALL
      SELECT 'Gbenkfay' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.30351964 AS lat, -12.26976328 AS lon
      UNION ALL
      SELECT 'Gbonkobana' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.24952423 AS lat, -12.31980739 AS lon
      UNION ALL
      SELECT 'Kamaranka' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.28896426 AS lat, -12.19680542 AS lon
      UNION ALL
      SELECT 'Kambia' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.34059278 AS lat, -12.32533745 AS lon
      UNION ALL
      SELECT 'Kayourgbor' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.24795655 AS lat, -12.38979878 AS lon
      UNION ALL
      SELECT 'Laminaya' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.31976166 AS lat, -12.38222675 AS lon
      UNION ALL
      SELECT 'Makulon' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.31026437 AS lat, -12.31732691 AS lon
      UNION ALL
      SELECT 'Makumray A' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.2468398 AS lat, -12.25710866 AS lon
      UNION ALL
      SELECT 'Makumray B' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.24802447 AS lat, -12.29587217 AS lon
      UNION ALL
      SELECT 'Rogberay' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.27660317 AS lat, -12.37218028 AS lon
      UNION ALL
      SELECT 'Romaneh' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.30885888 AS lat, -12.18277233 AS lon
      UNION ALL
      SELECT 'Royeama A' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.25837091 AS lat, -12.16424291 AS lon
      UNION ALL
      SELECT 'Royeama B' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.28797976 AS lat, -12.16378815 AS lon
      UNION ALL
      SELECT 'Sakuma A' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.26869183 AS lat, -12.20392527 AS lon
      UNION ALL
      SELECT 'Sakuma B' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.26566741 AS lat, -12.23411039 AS lon
      UNION ALL
      SELECT 'Sendugu A' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.34499047 AS lat, -12.2180422 AS lon
      UNION ALL
      SELECT 'Sendugu B' AS town, 'Gbanti Kamarank' AS chiefdom, 'Bombali' AS district, 9.33134428 AS lat, -12.24330086 AS lon
      UNION ALL
      SELECT 'Garanganwa' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 8.96586745 AS lat, -12.26150809 AS lon
      UNION ALL
      SELECT 'Gbendembu' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.08244414 AS lat, -12.20663825 AS lon
      UNION ALL
      SELECT 'Kalangba' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.00034685 AS lat, -12.16927595 AS lon
      UNION ALL
      SELECT 'Kania' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.07368987 AS lat, -12.13395724 AS lon
      UNION ALL
      SELECT 'Lobanga' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.19978371 AS lat, -12.04910834 AS lon
      UNION ALL
      SELECT 'Lohindie' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.14175652 AS lat, -12.11027019 AS lon
      UNION ALL
      SELECT 'Loko-Madina' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.11621191 AS lat, -12.04987496 AS lon
      UNION ALL
      SELECT 'Makai' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.13653429 AS lat, -12.18892458 AS lon
      UNION ALL
      SELECT 'Makarihiteh' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.02694871 AS lat, -12.10988922 AS lon
      UNION ALL
      SELECT 'Makeregbohun' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 8.99777926 AS lat, -12.07795382 AS lon
      UNION ALL
      SELECT 'Makump' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.05095604 AS lat, -12.07176074 AS lon
      UNION ALL
      SELECT 'Mamaka' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.04606133 AS lat, -12.31567758 AS lon
      UNION ALL
      SELECT 'Mamukay' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.01859812 AS lat, -12.22782685 AS lon
      UNION ALL
      SELECT 'Masongbo' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 8.95498867 AS lat, -12.19222478 AS lon
      UNION ALL
      SELECT 'Matehun' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.05354706 AS lat, -12.17048186 AS lon
      UNION ALL
      SELECT 'Mayorthan' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.10570749 AS lat, -12.24525161 AS lon
      UNION ALL
      SELECT 'Sahun' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.10985827 AS lat, -12.07333632 AS lon
      UNION ALL
      SELECT 'Tambiama' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 8.98450702 AS lat, -12.1009576 AS lon
      UNION ALL
      SELECT 'Tanyehun' AS town, 'Gbendembu Ngowa' AS chiefdom, 'Bombali' AS district, 9.1988879 AS lat, -12.09897805 AS lon
      UNION ALL
      SELECT 'Hunduwa' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.26082666 AS lat, -12.03697712 AS lon
      UNION ALL
      SELECT 'Kababala' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.18601672 AS lat, -12.1659818 AS lon
      UNION ALL
      SELECT 'Kagberay' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.21303737 AS lat, -12.1306152 AS lon
      UNION ALL
      SELECT 'Kawungulu' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.34178153 AS lat, -11.96427541 AS lon
      UNION ALL
      SELECT 'Makendema' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.31482782 AS lat, -12.01497653 AS lon
      UNION ALL
      SELECT 'Mambiama' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.31391409 AS lat, -12.09161092 AS lon
      UNION ALL
      SELECT 'Manjahagha' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.24635566 AS lat, -12.00514132 AS lon
      UNION ALL
      SELECT 'Sokudala' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.36994829 AS lat, -11.96560837 AS lon
      UNION ALL
      SELECT 'Yana' AS town, 'Magbaimba Ndorh' AS chiefdom, 'Bombali' AS district, 9.36320956 AS lat, -11.99609863 AS lon
      UNION ALL
      SELECT 'Gborbana' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.94408999 AS lat, -12.04453214 AS lon
      UNION ALL
      SELECT 'Mabanta' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.92856514 AS lat, -12.07046419 AS lon
      UNION ALL
      SELECT 'Magbenteh' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.88342268 AS lat, -12.08014877 AS lon
      UNION ALL
      SELECT 'Mangay' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.91977803 AS lat, -12.10431742 AS lon
      UNION ALL
      SELECT 'Mankene' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.83137241 AS lat, -12.13961816 AS lon
      UNION ALL
      SELECT 'Masongbo A' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.87594092 AS lat, -12.10701676 AS lon
      UNION ALL
      SELECT 'Masongbo B' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.84375179 AS lat, -12.30624874 AS lon
      UNION ALL
      SELECT 'Punthun' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.93829853 AS lat, -12.13950933 AS lon
      UNION ALL
      SELECT 'Rosint' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.89063041 AS lat, -12.01362456 AS lon
      UNION ALL
      SELECT 'Tonkoba' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.88309209 AS lat, -12.29494415 AS lon
      UNION ALL
      SELECT 'Yainkassa' AS town, 'Makari Gbanti' AS chiefdom, 'Bombali' AS district, 8.76859216 AS lat, -12.27176154 AS lon
      UNION ALL
      SELECT 'Kathanthan' AS town, 'Paki Masabong' AS chiefdom, 'Bombali' AS district, 8.87953856 AS lat, -11.92799958 AS lon
      UNION ALL
      SELECT 'Kathegeya' AS town, 'Paki Masabong' AS chiefdom, 'Bombali' AS district, 8.86691678 AS lat, -11.88723913 AS lon
      UNION ALL
      SELECT 'Mapaki' AS town, 'Paki Masabong' AS chiefdom, 'Bombali' AS district, 8.80043553 AS lat, -11.91024436 AS lon
      UNION ALL
      SELECT 'Masabong' AS town, 'Paki Masabong' AS chiefdom, 'Bombali' AS district, 8.72089588 AS lat, -11.99946205 AS lon
      UNION ALL
      SELECT 'Mayagba' AS town, 'Paki Masabong' AS chiefdom, 'Bombali' AS district, 8.75382632 AS lat, -11.95638163 AS lon
      UNION ALL
      SELECT 'Rosanda' AS town, 'Paki Masabong' AS chiefdom, 'Bombali' AS district, 8.82791899 AS lat, -11.97266486 AS lon
      UNION ALL
      SELECT 'Binkolo' AS town, 'Safroko Limba' AS chiefdom, 'Bombali' AS district, 8.94023128 AS lat, -11.97160784 AS lon
      UNION ALL
      SELECT 'Bombali Bana' AS town, 'Safroko Limba' AS chiefdom, 'Bombali' AS district, 9.00694512 AS lat, -12.00970328 AS lon
      UNION ALL
      SELECT 'Kabonka' AS town, 'Safroko Limba' AS chiefdom, 'Bombali' AS district, 9.00729453 AS lat, -11.90686309 AS lon
      UNION ALL
      SELECT 'Kasengbeh' AS town, 'Safroko Limba' AS chiefdom, 'Bombali' AS district, 9.09645804 AS lat, -11.84789778 AS lon
      UNION ALL
      SELECT 'Kayassi' AS town, 'Safroko Limba' AS chiefdom, 'Bombali' AS district, 9.0267451 AS lat, -11.84924607 AS lon
      UNION ALL
      SELECT 'Mabamba' AS town, 'Safroko Limba' AS chiefdom, 'Bombali' AS district, 8.9553606 AS lat, -11.9026386 AS lon
      UNION ALL
      SELECT 'Masapi' AS town, 'Safroko Limba' AS chiefdom, 'Bombali' AS district, 9.04552134 AS lat, -11.78559014 AS lon
      UNION ALL
      SELECT 'Bombali Sebora - B' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.88237938 AS lat, -12.04226489 AS lon
      UNION ALL
      SELECT 'Bombali Sebora - K' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.86957413 AS lat, -12.03312871 AS lon
      UNION ALL
      SELECT 'Bombali Sebora - Makeni' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.88132064 AS lat, -12.05412908 AS lon
      UNION ALL
      SELECT 'Bombali Sebora - R' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.89806883 AS lat, -12.042882 AS lon
      UNION ALL
      SELECT 'Bombali Sebora - T' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.88391752 AS lat, -12.03481164 AS lon
      UNION ALL
      SELECT 'Bombali Sebora - W' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.8922452 AS lat, -12.04864542 AS lon
      UNION ALL
      SELECT 'Makari Gbanti - Mi' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.890943 AS lat, -12.05871954 AS lon
      UNION ALL
      SELECT 'Makari Gbanti -Mas' AS town, 'Makeni Town' AS chiefdom, 'Bombali' AS district, 8.89467737 AS lat, -12.03183663 AS lon
      UNION ALL
      SELECT 'Darakuru' AS town, 'Diang' AS chiefdom, 'Koinadugu' AS district, 9.21506406 AS lat, -11.46088153 AS lon
      UNION ALL
      SELECT 'Gbenekoro' AS town, 'Diang' AS chiefdom, 'Koinadugu' AS district, 9.25524971 AS lat, -11.60875506 AS lon
      UNION ALL
      SELECT 'Kania' AS town, 'Diang' AS chiefdom, 'Koinadugu' AS district, 9.14573767 AS lat, -11.63769173 AS lon
      UNION ALL
      SELECT 'Kondembaia' AS town, 'Diang' AS chiefdom, 'Koinadugu' AS district, 9.38090196 AS lat, -11.63678075 AS lon
      UNION ALL
      SELECT 'Lengekoro' AS town, 'Diang' AS chiefdom, 'Koinadugu' AS district, 9.44960711 AS lat, -11.63746281 AS lon
      UNION ALL
      SELECT 'Sokurala' AS town, 'Diang' AS chiefdom, 'Koinadugu' AS district, 9.31986373 AS lat, -11.49828012 AS lon
      UNION ALL
      SELECT 'Gbonkobor' AS town, 'Kasunko' AS chiefdom, 'Koinadugu' AS district, 9.51351736 AS lat, -11.81617929 AS lon
      UNION ALL
      SELECT 'Kakallain' AS town, 'Kasunko' AS chiefdom, 'Koinadugu' AS district, 9.30450656 AS lat, -11.80776352 AS lon
      UNION ALL
      SELECT 'Kasunko' AS town, 'Kasunko' AS chiefdom, 'Koinadugu' AS district, 9.33532015 AS lat, -11.73278042 AS lon
      UNION ALL
      SELECT 'Kayaka' AS town, 'Kasunko' AS chiefdom, 'Koinadugu' AS district, 9.4841788 AS lat, -11.7346467 AS lon
      UNION ALL
      SELECT 'Tamiso I' AS town, 'Kasunko' AS chiefdom, 'Koinadugu' AS district, 9.60415055 AS lat, -12.05741627 AS lon
      UNION ALL
      SELECT 'Tamiso II' AS town, 'Kasunko' AS chiefdom, 'Koinadugu' AS district, 9.59195034 AS lat, -11.92497849 AS lon
      UNION ALL
      SELECT 'Barawa' AS town, 'Nieni' AS chiefdom, 'Koinadugu' AS district, 9.31403668 AS lat, -11.34919176 AS lon
      UNION ALL
      SELECT 'Kalian' AS town, 'Nieni' AS chiefdom, 'Koinadugu' AS district, 9.01386192 AS lat, -11.36394986 AS lon
      UNION ALL
      SELECT 'Sumbaria' AS town, 'Nieni' AS chiefdom, 'Koinadugu' AS district, 8.78782094 AS lat, -11.36702476 AS lon
      UNION ALL
      SELECT 'Wollay' AS town, 'Nieni' AS chiefdom, 'Koinadugu' AS district, 9.2008571 AS lat, -11.15926771 AS lon
      UNION ALL
      SELECT 'Yiffin' AS town, 'Nieni' AS chiefdom, 'Koinadugu' AS district, 9.06194134 AS lat, -11.23454618 AS lon
      UNION ALL
      SELECT 'Bendugu' AS town, 'Sengbe' AS chiefdom, 'Koinadugu' AS district, 9.57875363 AS lat, -11.50697129 AS lon
      UNION ALL
      SELECT 'Heremakono' AS town, 'Sengbe' AS chiefdom, 'Koinadugu' AS district, 9.60727593 AS lat, -11.41526131 AS lon
      UNION ALL
      SELECT 'Koinadugu' AS town, 'Sengbe' AS chiefdom, 'Koinadugu' AS district, 9.52766487 AS lat, -11.38754247 AS lon
      UNION ALL
      SELECT 'Yogomaia' AS town, 'Sengbe' AS chiefdom, 'Koinadugu' AS district, 9.59362321 AS lat, -11.55351188 AS lon
      UNION ALL
      SELECT 'Bilimaia' AS town, 'Sengbe' AS chiefdom, 'Koinadugu' AS district, 9.59578405 AS lat, -11.54575733 AS lon
      UNION ALL
      SELECT 'Bafodia' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.72403898 AS lat, -11.73388707 AS lon
      UNION ALL
      SELECT 'Kadanso' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.59693055 AS lat, -11.7505448 AS lon
      UNION ALL
      SELECT 'Kakoya' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.69521068 AS lat, -11.6691676 AS lon
      UNION ALL
      SELECT 'Kamanikie' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.6767762 AS lat, -11.81357242 AS lon
      UNION ALL
      SELECT 'Kamayortortor' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.66517893 AS lat, -11.85794785 AS lon
      UNION ALL
      SELECT 'Kambalia' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.85457148 AS lat, -11.81183087 AS lon
      UNION ALL
      SELECT 'Kambia' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.84660649 AS lat, -11.88066608 AS lon
      UNION ALL
      SELECT 'Kaponpon' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.60591355 AS lat, -11.70044234 AS lon
      UNION ALL
      SELECT 'Pampakoh' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.7659237 AS lat, -11.85470063 AS lon
      UNION ALL
      SELECT 'Semamaia' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.62570905 AS lat, -11.67034828 AS lon
      UNION ALL
      SELECT 'Taelia' AS town, 'Wara Wara Bafod' AS chiefdom, 'Koinadugu' AS district, 9.9452592 AS lat, -11.865642 AS lon
      UNION ALL
      SELECT 'Zone 1' AS town, 'Wara Wara Yagal' AS chiefdom, 'Koinadugu' AS district, 9.63145297 AS lat, -11.55373072 AS lon
      UNION ALL
      SELECT 'Zone 2' AS town, 'Wara Wara Yagal' AS chiefdom, 'Koinadugu' AS district, 9.60575802 AS lat, -11.6099153 AS lon
      UNION ALL
      SELECT 'Zone 3' AS town, 'Wara Wara Yagal' AS chiefdom, 'Koinadugu' AS district, 9.58299057 AS lat, -11.55432668 AS lon
      UNION ALL
      SELECT 'Zone 4' AS town, 'Wara Wara Yagal' AS chiefdom, 'Koinadugu' AS district, 9.5592478 AS lat, -11.58502313 AS lon
      UNION ALL
      SELECT 'Zone 5' AS town, 'Wara Wara Yagal' AS chiefdom, 'Koinadugu' AS district, 9.52561159 AS lat, -11.57847777 AS lon
      UNION ALL
      SELECT 'Zone 6' AS town, 'Wara Wara Yagal' AS chiefdom, 'Koinadugu' AS district, 9.51325583 AS lat, -11.68691622 AS lon
      UNION ALL
      SELECT 'Zone 7' AS town, 'Wara Wara Yagal' AS chiefdom, 'Koinadugu' AS district, 9.50225258 AS lat, -11.6131766 AS lon
      UNION ALL
      SELECT 'Lower Massakong' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.45120933 AS lat, -12.00440136 AS lon
      UNION ALL
      SELECT 'Lower Polie' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.52652396 AS lat, -11.98458469 AS lon
      UNION ALL
      SELECT 'Mayeppoh' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.52816973 AS lat, -11.77843387 AS lon
      UNION ALL
      SELECT 'Petifu Mayawa A' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.43162094 AS lat, -11.7835785 AS lon
      UNION ALL
      SELECT 'Petifu Mayawa B' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.38328801 AS lat, -11.81863606 AS lon
      UNION ALL
      SELECT 'Petifu Mayeppoh' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.54197566 AS lat, -11.85827616 AS lon
      UNION ALL
      SELECT 'Upper Massakong' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.45096675 AS lat, -11.9023699 AS lon
      UNION ALL
      SELECT 'Upper Polie' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.52334283 AS lat, -11.92343273 AS lon
      UNION ALL
      SELECT 'Yele Manowo' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.40680695 AS lat, -11.85660347 AS lon
      UNION ALL
      SELECT 'Yiben' AS town, 'Gbonkolenken' AS chiefdom, 'Tonkolili' AS district, 8.39217737 AS lat, -11.93974416 AS lon
      UNION ALL
      SELECT 'Kabaia' AS town, 'Kafe Simiria' AS chiefdom, 'Tonkolili' AS district, 8.80513989 AS lat, -11.6101419 AS lon
      UNION ALL
      SELECT 'Kamarugu' AS town, 'Kafe Simiria' AS chiefdom, 'Tonkolili' AS district, 8.79503635 AS lat, -11.68908498 AS lon
      UNION ALL
      SELECT 'Mabonto' AS town, 'Kafe Simiria' AS chiefdom, 'Tonkolili' AS district, 8.86203518 AS lat, -11.81677843 AS lon
      UNION ALL
      SELECT 'Makelfa' AS town, 'Kafe Simiria' AS chiefdom, 'Tonkolili' AS district, 8.87264056 AS lat, -11.74583799 AS lon
      UNION ALL
      SELECT 'Makontande' AS town, 'Kafe Simiria' AS chiefdom, 'Tonkolili' AS district, 8.95838836 AS lat, -11.79463553 AS lon
      UNION ALL
      SELECT 'Mayaso' AS town, 'Kafe Simiria' AS chiefdom, 'Tonkolili' AS district, 8.95384694 AS lat, -11.84682329 AS lon
      UNION ALL
      SELECT 'Simiria' AS town, 'Kafe Simiria' AS chiefdom, 'Tonkolili' AS district, 8.87853897 AS lat, -11.85640465 AS lon
      UNION ALL
      SELECT 'Fuladugu' AS town, 'Kalansogoia' AS chiefdom, 'Tonkolili' AS district, 9.2146404 AS lat, -11.73021139 AS lon
      UNION ALL
      SELECT 'Kakallain' AS town, 'Kalansogoia' AS chiefdom, 'Tonkolili' AS district, 9.20079836 AS lat, -11.78628869 AS lon
      UNION ALL
      SELECT 'Kamakathie' AS town, 'Kalansogoia' AS chiefdom, 'Tonkolili' AS district, 9.09729819 AS lat, -11.7761301 AS lon
      UNION ALL
      SELECT 'Kamakilla' AS town, 'Kalansogoia' AS chiefdom, 'Tonkolili' AS district, 9.1196642 AS lat, -11.80880937 AS lon
      UNION ALL
      SELECT 'Kasokira' AS town, 'Kalansogoia' AS chiefdom, 'Tonkolili' AS district, 9.11231898 AS lat, -11.73488798 AS lon
      UNION ALL
      SELECT 'Lower Section' AS town, 'Kalansogoia' AS chiefdom, 'Tonkolili' AS district, 8.98415322 AS lat, -11.75631161 AS lon
      UNION ALL
      SELECT 'Upper Section' AS town, 'Kalansogoia' AS chiefdom, 'Tonkolili' AS district, 9.01679076 AS lat, -11.68552872 AS lon
      UNION ALL
      SELECT 'Kumrabai' AS town, 'Kholifa Mabang' AS chiefdom, 'Tonkolili' AS district, 8.52422996 AS lat, -12.10587123 AS lon
      UNION ALL
      SELECT 'Mabang' AS town, 'Kholifa Mabang' AS chiefdom, 'Tonkolili' AS district, 8.5499993 AS lat, -12.1494296 AS lon
      UNION ALL
      SELECT 'Marunia Koray' AS town, 'Kholifa Mabang' AS chiefdom, 'Tonkolili' AS district, 8.58511663 AS lat, -12.25003241 AS lon
      UNION ALL
      SELECT 'Marunia Sakie' AS town, 'Kholifa Mabang' AS chiefdom, 'Tonkolili' AS district, 8.52893201 AS lat, -12.22050278 AS lon
      UNION ALL
      SELECT 'Bo Road' AS town, 'Kholifa Rowala' AS chiefdom, 'Tonkolili' AS district, 8.71904344 AS lat, -11.93907102 AS lon
      UNION ALL
      SELECT 'Lal-Lenken' AS town, 'Kholifa Rowala' AS chiefdom, 'Tonkolili' AS district, 8.75986565 AS lat, -11.86551662 AS lon
      UNION ALL
      SELECT 'Makump' AS town, 'Kholifa Rowala' AS chiefdom, 'Tonkolili' AS district, 8.68275475 AS lat, -11.92269822 AS lon
      UNION ALL
      SELECT 'Mamuntha' AS town, 'Kholifa Rowala' AS chiefdom, 'Tonkolili' AS district, 8.64639084 AS lat, -12.06189301 AS lon
      UNION ALL
      SELECT 'Mayatha' AS town, 'Kholifa Rowala' AS chiefdom, 'Tonkolili' AS district, 8.66493693 AS lat, -11.98923315 AS lon
      UNION ALL
      SELECT 'Mayossoh' AS town, 'Kholifa Rowala' AS chiefdom, 'Tonkolili' AS district, 8.56269089 AS lat, -12.0238287 AS lon
      UNION ALL
      SELECT 'Old Magburaka' AS town, 'Kholifa Rowala' AS chiefdom, 'Tonkolili' AS district, 8.72001304 AS lat, -11.95946003 AS lon
      UNION ALL
      SELECT 'Makali' AS town, 'Kunike Barina' AS chiefdom, 'Tonkolili' AS district, 8.64830484 AS lat, -11.55436314 AS lon
      UNION ALL
      SELECT 'Makong' AS town, 'Kunike Barina' AS chiefdom, 'Tonkolili' AS district, 8.53475139 AS lat, -11.70779872 AS lon
      UNION ALL
      SELECT 'Mamurie' AS town, 'Kunike Barina' AS chiefdom, 'Tonkolili' AS district, 8.64060016 AS lat, -11.71196833 AS lon
      UNION ALL
      SELECT 'Masaba' AS town, 'Kunike Barina' AS chiefdom, 'Tonkolili' AS district, 8.52781139 AS lat, -11.62455857 AS lon
      UNION ALL
      SELECT 'Mathonkara' AS town, 'Kunike Barina' AS chiefdom, 'Tonkolili' AS district, 8.61464909 AS lat, -11.57805711 AS lon
      UNION ALL
      SELECT 'Wonkibor' AS town, 'Kunike Barina' AS chiefdom, 'Tonkolili' AS district, 8.56380236 AS lat, -11.59030387 AS lon
      UNION ALL
      SELECT 'Masingbi' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.63712168 AS lat, -11.46694013 AS lon
      UNION ALL
      SELECT 'Rolal' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.71802974 AS lat, -11.5512989 AS lon
      UNION ALL
      SELECT 'Sanda' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.59711613 AS lat, -11.50471779 AS lon
      UNION ALL
      SELECT 'Semorkanie' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.69651091 AS lat, -11.62322328 AS lon
      UNION ALL
      SELECT 'Thamah' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.59408314 AS lat, -11.39836799 AS lon
      UNION ALL
      SELECT 'Thambaya' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.77493985 AS lat, -11.44771195 AS lon
      UNION ALL
      SELECT 'Wana' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.80513989 AS lat, -11.51886206 AS lon
      UNION ALL
      SELECT 'Yenkeh' AS town, 'Kunike' AS chiefdom, 'Tonkolili' AS district, 8.6861247 AS lat, -11.45151036 AS lon
      UNION ALL
      SELECT 'Kiamp Kakolo' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.64178995 AS lat, -12.20429957 AS lon
      UNION ALL
      SELECT 'Mabilafu' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.71401595 AS lat, -12.2052309 AS lon
      UNION ALL
      SELECT 'Makoba' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.6170509 AS lat, -12.31122613 AS lon
      UNION ALL
      SELECT 'Malal' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.713246 AS lat, -12.29733623 AS lon
      UNION ALL
      SELECT 'Manewa' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.67838606 AS lat, -12.15224953 AS lon
      UNION ALL
      SELECT 'Mara' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.66863027 AS lat, -12.22901465 AS lon
      UNION ALL
      SELECT 'Matanka' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.67505481 AS lat, -12.36031302 AS lon
      UNION ALL
      SELECT 'Rochen' AS town, 'Malal Mara' AS chiefdom, 'Tonkolili' AS district, 8.6548294 AS lat, -12.28751487 AS lon
      UNION ALL
      SELECT 'Borowah' AS town, 'Sambaya' AS chiefdom, 'Tonkolili' AS district, 9.13907503 AS lat, -11.50632282 AS lon
      UNION ALL
      SELECT 'Buyan' AS town, 'Sambaya' AS chiefdom, 'Tonkolili' AS district, 8.93582026 AS lat, -11.55348924 AS lon
      UNION ALL
      SELECT 'Dayie' AS town, 'Sambaya' AS chiefdom, 'Tonkolili' AS district, 9.00132933 AS lat, -11.62229509 AS lon
      UNION ALL
      SELECT 'Sambaya' AS town, 'Sambaya' AS chiefdom, 'Tonkolili' AS district, 9.03688797 AS lat, -11.48969743 AS lon
      UNION ALL
      SELECT 'Maboboh Koray' AS town, 'Tane' AS chiefdom, 'Tonkolili' AS district, 8.71633803 AS lat, -11.74843129 AS lon
      UNION ALL
      SELECT 'Makrugbeh' AS town, 'Tane' AS chiefdom, 'Tonkolili' AS district, 8.60840609 AS lat, -11.77717471 AS lon
      UNION ALL
      SELECT 'Mange-bana' AS town, 'Tane' AS chiefdom, 'Tonkolili' AS district, 8.58469871 AS lat, -11.92746158 AS lon
      UNION ALL
      SELECT 'Mapakie' AS town, 'Tane' AS chiefdom, 'Tonkolili' AS district, 8.61728675 AS lat, -11.90010584 AS lon
      UNION ALL
      SELECT 'Mathunkara' AS town, 'Tane' AS chiefdom, 'Tonkolili' AS district, 8.76397999 AS lat, -11.77523423 AS lon
      UNION ALL
      SELECT 'Matotoka' AS town, 'Tane' AS chiefdom, 'Tonkolili' AS district, 8.66030247 AS lat, -11.8377648 AS lon
      UNION ALL
      SELECT 'Foindu' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.35665394 AS lat, -12.07818868 AS lon
      UNION ALL
      SELECT 'Gaindema' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.41289672 AS lat, -12.1555864 AS lon
      UNION ALL
      SELECT 'Macrogba' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.40064133 AS lat, -12.35089251 AS lon
      UNION ALL
      SELECT 'Makeni Rokefula' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.41086447 AS lat, -12.55426349 AS lon
      UNION ALL
      SELECT 'Malanchor' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.35233579 AS lat, -12.59084462 AS lon
      UNION ALL
      SELECT 'Malompor' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.42613575 AS lat, -12.10417732 AS lon
      UNION ALL
      SELECT 'Mamaka' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.51051686 AS lat, -12.32277784 AS lon
      UNION ALL
      SELECT 'Masengbe' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.31454445 AS lat, -12.11144579 AS lon
      UNION ALL
      SELECT 'Mayira' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.41333793 AS lat, -12.41622379 AS lon
      UNION ALL
      SELECT 'Petifu Upper' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.39417764 AS lat, -12.28376974 AS lon
      UNION ALL
      SELECT 'Petifu-Lower' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.35977197 AS lat, -12.41800244 AS lon
      UNION ALL
      SELECT 'Ronietta' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.38342447 AS lat, -12.46565295 AS lon
      UNION ALL
      SELECT 'Yoni' AS town, 'Yoni' AS chiefdom, 'Tonkolili' AS district, 8.43289884 AS lat, -12.23017351 AS lon
      UNION ALL
      SELECT 'Kunbulun 1' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.91432178 AS lat, -11.47460063 AS lon
      UNION ALL
      SELECT 'Kunbulun 2' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.8508755 AS lat, -11.50887264 AS lon
      UNION ALL
      SELECT 'Manan' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.74890356 AS lat, -11.48143166 AS lon
      UNION ALL
      SELECT 'Mawundea' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.95339125 AS lat, -11.46083576 AS lon
      UNION ALL
      SELECT 'Numula 1' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.89255744 AS lat, -11.50043223 AS lon
      UNION ALL
      SELECT 'Numula 2' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.90654768 AS lat, -11.41623736 AS lon
      UNION ALL
      SELECT 'Numula 3' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.80719163 AS lat, -11.5145926 AS lon
      UNION ALL
      SELECT 'Numula 4' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.74580951 AS lat, -11.51165144 AS lon
      UNION ALL
      SELECT 'Numula 5' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.76318667 AS lat, -11.45315851 AS lon
      UNION ALL
      SELECT 'Sinkunia' AS town, 'Dembelia - Sink' AS chiefdom, 'Fabala' AS district, 9.84635736 AS lat, -11.43365219 AS lon
      UNION ALL
      SELECT 'Balandugu' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.66350418 AS lat, -11.55874196 AS lon
      UNION ALL
      SELECT 'Dogoloya' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.69951203 AS lat, -11.55349998 AS lon
      UNION ALL
      SELECT 'Fissaya I' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.97371659 AS lat, -11.6254188 AS lon
      UNION ALL
      SELECT 'Fissaya II' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.97294932 AS lat, -11.69321016 AS lon
      UNION ALL
      SELECT 'Gbentu III' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.92505382 AS lat, -11.60636831 AS lon
      UNION ALL
      SELECT 'Herekor' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.80519254 AS lat, -11.56905742 AS lon
      UNION ALL
      SELECT 'Kalia' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.93072131 AS lat, -11.69549784 AS lon
      UNION ALL
      SELECT 'Kamba' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.83019882 AS lat, -11.67681534 AS lon
      UNION ALL
      SELECT 'Lagor' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.7160179 AS lat, -11.61581699 AS lon
      UNION ALL
      SELECT 'Musaia' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.71101753 AS lat, -11.52205783 AS lon
      UNION ALL
      SELECT 'Sankan I' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.84488905 AS lat, -11.56393517 AS lon
      UNION ALL
      SELECT 'Sankan II' AS town, 'Folosaba Dembel' AS chiefdom, 'Fabala' AS district, 9.90349267 AS lat, -11.55639431 AS lon
      UNION ALL
      SELECT 'Benadugu' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.33654379 AS lat, -10.9530197 AS lon
      UNION ALL
      SELECT 'Deldugu' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.27192052 AS lat, -10.7252149 AS lon
      UNION ALL
      SELECT 'Mankalia' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.37717404 AS lat, -10.81243182 AS lon
      UNION ALL
      SELECT 'Mongo I' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.48068779 AS lat, -10.93294897 AS lon
      UNION ALL
      SELECT 'Mongo II' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.6265306 AS lat, -10.99407128 AS lon
      UNION ALL
      SELECT 'Morifindugu' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.51725535 AS lat, -11.11011722 AS lon
      UNION ALL
      SELECT 'Kulor' AS town, 'Neya' AS chiefdom, 'Fabala' AS district, 9.05181601 AS lat, -10.62725296 AS lon
      UNION ALL
      SELECT 'Neya I' AS town, 'Neya' AS chiefdom, 'Fabala' AS district, 9.18836099 AS lat, -10.82268037 AS lon
      UNION ALL
      SELECT 'Neya II' AS town, 'Neya' AS chiefdom, 'Fabala' AS district, 9.08582038 AS lat, -10.90862515 AS lon
      UNION ALL
      SELECT 'Nyedu' AS town, 'Neya' AS chiefdom, 'Fabala' AS district, 9.16056339 AS lat, -11.05254512 AS lon
      UNION ALL
      SELECT 'Saradu' AS town, 'Neya' AS chiefdom, 'Fabala' AS district, 9.06563898 AS lat, -10.75526853 AS lon
      UNION ALL
      SELECT 'Lower Kamadugu' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.45616852 AS lat, -11.44897053 AS lon
      UNION ALL
      SELECT 'Upper Kamadugu' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.56928046 AS lat, -11.27026146 AS lon
      UNION ALL
      SELECT 'Yiraia' AS town, 'Mongo' AS chiefdom, 'Fabala' AS district, 9.40814214 AS lat, -11.20056598 AS lon
      UNION ALL
      SELECT 'Biribaia' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.7955297 AS lat, -11.2483866 AS lon
      UNION ALL
      SELECT 'Dara' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.85632049 AS lat, -11.25236383 AS lon
      UNION ALL
      SELECT 'Falaba' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.83539315 AS lat, -11.31456304 AS lon
      UNION ALL
      SELECT 'Fudea' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.68696804 AS lat, -11.39089919 AS lon
      UNION ALL
      SELECT 'Ganya' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.93536382 AS lat, -11.28720341 AS lon
      UNION ALL
      SELECT 'Gberia Fotombu' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.88284915 AS lat, -11.20082322 AS lon
      UNION ALL
      SELECT 'Gberia-Timbako' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.74661302 AS lat, -11.18422469 AS lon
      UNION ALL
      SELECT 'Kaliyereh' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.94760318 AS lat, -11.20686685 AS lon
      UNION ALL
      SELECT 'Koindu-Kura' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.88296973 AS lat, -11.16421864 AS lon
      UNION ALL
      SELECT 'Laylay' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.85740576 AS lat, -11.23256112 AS lon
      UNION ALL
      SELECT 'Nomokoya' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.95345769 AS lat, -11.37400259 AS lon
      UNION ALL
      SELECT 'Sonkoya' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.76848653 AS lat, -11.41280672 AS lon
      UNION ALL
      SELECT 'Damai' AS town, 'Badjia' AS chiefdom, 'Bo' AS district, 8.07728211 AS lat, -11.4212108 AS lon
      UNION ALL
      SELECT 'Fallay' AS town, 'Badjia' AS chiefdom, 'Bo' AS district, 8.11724066 AS lat, -11.36603713 AS lon
      UNION ALL
      SELECT 'Kpallay' AS town, 'Badjia' AS chiefdom, 'Bo' AS district, 8.04854915 AS lat, -11.46927508 AS lon
      UNION ALL
      SELECT 'Njargbahun' AS town, 'Badjia' AS chiefdom, 'Bo' AS district, 8.11632823 AS lat, -11.45719457 AS lon
      UNION ALL
      SELECT 'Sei' AS town, 'Badjia' AS chiefdom, 'Bo' AS district, 8.07248904 AS lat, -11.37034501 AS lon
      UNION ALL
      SELECT 'Bum' AS town, 'Bagbo' AS chiefdom, 'Bo' AS district, 7.50802665 AS lat, -11.8693571 AS lon
      UNION ALL
      SELECT 'Gorapon' AS town, 'Bagbo' AS chiefdom, 'Bo' AS district, 7.54304041 AS lat, -11.92161494 AS lon
      UNION ALL
      SELECT 'Jimmi' AS town, 'Bagbo' AS chiefdom, 'Bo' AS district, 7.6400944 AS lat, -11.81791029 AS lon
      UNION ALL
      SELECT 'Kpangbalia' AS town, 'Bagbo' AS chiefdom, 'Bo' AS district, 7.59171962 AS lat, -11.89038873 AS lon
      UNION ALL
      SELECT 'Mano' AS town, 'Bagbo' AS chiefdom, 'Bo' AS district, 7.5623378 AS lat, -11.86200798 AS lon
      UNION ALL
      SELECT 'Niagorehun' AS town, 'Bagbo' AS chiefdom, 'Bo' AS district, 7.67440673 AS lat, -11.76221987 AS lon
      UNION ALL
      SELECT 'Tissana' AS town, 'Bagbo' AS chiefdom, 'Bo' AS district, 7.58137066 AS lat, -11.94739807 AS lon
      UNION ALL
      SELECT 'Jongo' AS town, 'Bagbwe(Bagbe)' AS chiefdom, 'Bo' AS district, 8.062855 AS lat, -11.51967277 AS lon
      UNION ALL
      SELECT 'Kemoh' AS town, 'Bagbwe(Bagbe)' AS chiefdom, 'Bo' AS district, 8.0211421 AS lat, -11.50089463 AS lon
      UNION ALL
      SELECT 'Niawa' AS town, 'Bagbwe(Bagbe)' AS chiefdom, 'Bo' AS district, 8.03124667 AS lat, -11.57353076 AS lon
      UNION ALL
      SELECT 'Nyallay' AS town, 'Bagbwe(Bagbe)' AS chiefdom, 'Bo' AS district, 8.09787378 AS lat, -11.56766273 AS lon
      UNION ALL
      SELECT 'Samawa' AS town, 'Bagbwe(Bagbe)' AS chiefdom, 'Bo' AS district, 8.13426874 AS lat, -11.5083487 AS lon
      UNION ALL
      SELECT 'Bambawo' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 7.92903002 AS lat, -11.56142134 AS lon
      UNION ALL
      SELECT 'Fallay' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 7.94364422 AS lat, -11.43756111 AS lon
      UNION ALL
      SELECT 'Kimaya' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 7.97539569 AS lat, -11.48714347 AS lon
      UNION ALL
      SELECT 'Lower Pataloo' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 7.92511362 AS lat, -11.50108171 AS lon
      UNION ALL
      SELECT 'Mawojeh' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 7.87603453 AS lat, -11.48162406 AS lon
      UNION ALL
      SELECT 'Njeima' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 7.9524727 AS lat, -11.38508461 AS lon
      UNION ALL
      SELECT 'Sonnah' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 7.86091063 AS lat, -11.54030023 AS lon
      UNION ALL
      SELECT 'Upper Pataloo' AS town, 'Boama' AS chiefdom, 'Bo' AS district, 8.01431 AS lat, -11.42083221 AS lon
      UNION ALL
      SELECT 'Bongo' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.76813953 AS lat, -11.98856287 AS lon
      UNION ALL
      SELECT 'Bumpe' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.90853078 AS lat, -11.9252515 AS lon
      UNION ALL
      SELECT 'Foya' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.96121051 AS lat, -11.88414238 AS lon
      UNION ALL
      SELECT 'Kpetema' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.85615558 AS lat, -11.98743592 AS lon
      UNION ALL
      SELECT 'Sahn' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.71570186 AS lat, -12.050141 AS lon
      UNION ALL
      SELECT 'Serabu' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.81650313 AS lat, -12.06484444 AS lon
      UNION ALL
      SELECT 'Sewama' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.71288969 AS lat, -11.97177467 AS lon
      UNION ALL
      SELECT 'Taninahun' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.89767843 AS lat, -12.08597912 AS lon
      UNION ALL
      SELECT 'Walihun' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.76688767 AS lat, -12.0899193 AS lon
      UNION ALL
      SELECT 'Yengema' AS town, 'Bumpe Ngao' AS chiefdom, 'Bo' AS district, 7.85030437 AS lat, -12.01826511 AS lon
      UNION ALL
      SELECT 'Gbo' AS town, 'Gbo' AS chiefdom, 'Bo' AS district, 8.07594203 AS lat, -11.85065161 AS lon
      UNION ALL
      SELECT 'Maryu' AS town, 'Gbo' AS chiefdom, 'Bo' AS district, 8.05329174 AS lat, -11.88639435 AS lon
      UNION ALL
      SELECT 'Nyawa' AS town, 'Gbo' AS chiefdom, 'Bo' AS district, 8.0994189 AS lat, -11.80127737 AS lon
      UNION ALL
      SELECT 'Lower Baimba' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.73575606 AS lat, -11.70278309 AS lon
      UNION ALL
      SELECT 'Lower Kama' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.72042382 AS lat, -11.6710813 AS lon
      UNION ALL
      SELECT 'Lower Niawa' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.69508912 AS lat, -11.62726368 AS lon
      UNION ALL
      SELECT 'Nekpondo' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.86236194 AS lat, -11.58543911 AS lon
      UNION ALL
      SELECT 'Tongowa' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.83036724 AS lat, -11.64730619 AS lon
      UNION ALL
      SELECT 'Upper Baimba' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.78955899 AS lat, -11.67747943 AS lon
      UNION ALL
      SELECT 'Upper Kama' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.79475789 AS lat, -11.59154074 AS lon
      UNION ALL
      SELECT 'Upper Niawa' AS town, 'Jaiama Bongor' AS chiefdom, 'Bo' AS district, 7.78340321 AS lat, -11.53318091 AS lon
      UNION ALL
      SELECT 'Korjeh' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 7.93661595 AS lat, -11.59578531 AS lon
      UNION ALL
      SELECT 'Kpandobu' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 8.00362718 AS lat, -11.67070554 AS lon
      UNION ALL
      SELECT 'Nguabu' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 8.02428757 AS lat, -11.70674421 AS lon
      UNION ALL
      SELECT 'Nyallay' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 7.93628531 AS lat, -11.63741207 AS lon
      UNION ALL
      SELECT 'Nyawa' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 7.97993463 AS lat, -11.58017175 AS lon
      UNION ALL
      SELECT 'Samamie' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 7.99579229 AS lat, -11.75583011 AS lon
      UNION ALL
      SELECT 'Sewa' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 7.92142608 AS lat, -11.67758451 AS lon
      UNION ALL
      SELECT 'Sindeh' AS town, 'Kakua' AS chiefdom, 'Bo' AS district, 8.00496363 AS lat, -11.6061123 AS lon
      UNION ALL
      SELECT 'Keisua' AS town, 'Komboya' AS chiefdom, 'Bo' AS district, 8.21323207 AS lat, -11.50557155 AS lon
      UNION ALL
      SELECT 'Kemoh' AS town, 'Komboya' AS chiefdom, 'Bo' AS district, 8.19493996 AS lat, -11.41337058 AS lon
      UNION ALL
      SELECT 'Mangaru' AS town, 'Komboya' AS chiefdom, 'Bo' AS district, 8.30574942 AS lat, -11.51586217 AS lon
      UNION ALL
      SELECT 'Sei' AS town, 'Komboya' AS chiefdom, 'Bo' AS district, 8.21063233 AS lat, -11.45797827 AS lon
      UNION ALL
      SELECT 'Tongowa' AS town, 'Komboya' AS chiefdom, 'Bo' AS district, 8.26896055 AS lat, -11.55393626 AS lon
      UNION ALL
      SELECT 'Gao' AS town, 'Lugbu' AS chiefdom, 'Bo' AS district, 7.68691569 AS lat, -11.83334815 AS lon
      UNION ALL
      SELECT 'Kamba' AS town, 'Lugbu' AS chiefdom, 'Bo' AS district, 7.66490561 AS lat, -11.91114826 AS lon
      UNION ALL
      SELECT 'Kargbevu' AS town, 'Lugbu' AS chiefdom, 'Bo' AS district, 7.63434781 AS lat, -11.95881257 AS lon
      UNION ALL
      SELECT 'Kemoh' AS town, 'Lugbu' AS chiefdom, 'Bo' AS district, 7.69159441 AS lat, -11.89131458 AS lon
      UNION ALL
      SELECT 'Magbao' AS town, 'Lugbu' AS chiefdom, 'Bo' AS district, 7.74443957 AS lat, -11.89932772 AS lon
      UNION ALL
      SELECT 'Yorma' AS town, 'Lugbu' AS chiefdom, 'Bo' AS district, 7.73024538 AS lat, -11.80854951 AS lon
      UNION ALL
      SELECT 'Baimba' AS town, 'Niawa Lenga' AS chiefdom, 'Bo' AS district, 8.07054195 AS lat, -11.67476892 AS lon
      UNION ALL
      SELECT 'Lower Niawa' AS town, 'Niawa Lenga' AS chiefdom, 'Bo' AS district, 8.11413902 AS lat, -11.63284061 AS lon
      UNION ALL
      SELECT 'Upper Niawa' AS town, 'Niawa Lenga' AS chiefdom, 'Bo' AS district, 8.21344346 AS lat, -11.55466345 AS lon
      UNION ALL
      SELECT 'Yalenga' AS town, 'Niawa Lenga' AS chiefdom, 'Bo' AS district, 8.16975595 AS lat, -11.62945962 AS lon
      UNION ALL
      SELECT 'Kaduawo' AS town, 'Selenga' AS chiefdom, 'Bo' AS district, 8.10501412 AS lat, -11.76816296 AS lon
      UNION ALL
      SELECT 'Mokpendeh' AS town, 'Selenga' AS chiefdom, 'Bo' AS district, 8.12876197 AS lat, -11.72542262 AS lon
      UNION ALL
      SELECT 'Old Town' AS town, 'Selenga' AS chiefdom, 'Bo' AS district, 8.09872861 AS lat, -11.73360495 AS lon
      UNION ALL
      SELECT 'Bainyawa' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.70836163 AS lat, -11.74830973 AS lon
      UNION ALL
      SELECT 'Mambawa' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.78534671 AS lat, -11.83046832 AS lon
      UNION ALL
      SELECT 'Morku' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.77546465 AS lat, -11.86354945 AS lon
      UNION ALL
      SELECT 'Ngolamajie' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.99038328 AS lat, -11.82026421 AS lon
      UNION ALL
      SELECT 'Njagbla I' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.78321734 AS lat, -11.79452071 AS lon
      UNION ALL
      SELECT 'Njagbla II' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.81340217 AS lat, -11.75849047 AS lon
      UNION ALL
      SELECT 'Seiwa' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.86117413 AS lat, -11.78793749 AS lon
      UNION ALL
      SELECT 'Sendeh' AS town, 'Tikonko' AS chiefdom, 'Bo' AS district, 7.77631022 AS lat, -11.73105192 AS lon
      UNION ALL
      SELECT 'Deilenga' AS town, 'Valunia' AS chiefdom, 'Bo' AS district, 8.39370492 AS lat, -11.62496203 AS lon
      UNION ALL
      SELECT 'Kendebu' AS town, 'Valunia' AS chiefdom, 'Bo' AS district, 8.24496101 AS lat, -11.77100395 AS lon
      UNION ALL
      SELECT 'Lunia' AS town, 'Valunia' AS chiefdom, 'Bo' AS district, 8.35098164 AS lat, -11.74276078 AS lon
      UNION ALL
      SELECT 'Ngovo' AS town, 'Valunia' AS chiefdom, 'Bo' AS district, 8.17390653 AS lat, -11.77170009 AS lon
      UNION ALL
      SELECT 'Seilenga' AS town, 'Valunia' AS chiefdom, 'Bo' AS district, 8.30118542 AS lat, -11.64626588 AS lon
      UNION ALL
      SELECT 'Vanjelu' AS town, 'Valunia' AS chiefdom, 'Bo' AS district, 8.18834589 AS lat, -11.70399096 AS lon
      UNION ALL
      SELECT 'Yarlenga' AS town, 'Valunia' AS chiefdom, 'Bo' AS district, 8.22863672 AS lat, -11.63407034 AS lon
      UNION ALL
      SELECT 'Central Kargoi' AS town, 'Wonde' AS chiefdom, 'Bo' AS district, 7.73733062 AS lat, -11.44321113 AS lon
      UNION ALL
      SELECT 'Lower Kargoi' AS town, 'Wonde' AS chiefdom, 'Bo' AS district, 7.61113773 AS lat, -11.70724425 AS lon
      UNION ALL
      SELECT 'Manyeh' AS town, 'Wonde' AS chiefdom, 'Bo' AS district, 7.69792955 AS lat, -11.53119928 AS lon
      UNION ALL
      SELECT 'Upper Kargoi' AS town, 'Wonde' AS chiefdom, 'Bo' AS district, 7.782229 AS lat, -11.43749094 AS lon
      UNION ALL
      SELECT 'East Ward-Batiema' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.96510164 AS lat, -11.71394127 AS lon
      UNION ALL
      SELECT 'East Ward-Bumpeh-W' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.95437592 AS lat, -11.71454326 AS lon
      UNION ALL
      SELECT 'East Ward-Gbondo T' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.94282965 AS lat, -11.72082937 AS lon
      UNION ALL
      SELECT 'East Ward-Kindia T' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.96112168 AS lat, -11.72385562 AS lon
      UNION ALL
      SELECT 'East Ward-Lower Sa' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.96642187 AS lat, -11.7273171 AS lon
      UNION ALL
      SELECT 'East Ward-Manjama' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.94080676 AS lat, -11.72875202 AS lon
      UNION ALL
      SELECT 'East Ward-Messima' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.95129652 AS lat, -11.72418524 AS lon
      UNION ALL
      SELECT 'East Ward-Moriba T' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.96170791 AS lat, -11.73463462 AS lon
      UNION ALL
      SELECT 'North Ward-Bo Numb' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.97602553 AS lat, -11.72710852 AS lon
      UNION ALL
      SELECT 'North Ward-Kissy Town' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.96994312 AS lat, -11.73748364 AS lon
      UNION ALL
      SELECT 'North Ward-Njai To' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.9788139 AS lat, -11.73599531 AS lon
      UNION ALL
      SELECT 'North Ward-Reservation' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.97342 AS lat, -11.7520081 AS lon
      UNION ALL
      SELECT 'West Ward-Kandeh T' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.94453243 AS lat, -11.75149434 AS lon
      UNION ALL
      SELECT 'West Ward-Lewabu -' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.94123902 AS lat, -11.73918691 AS lon
      UNION ALL
      SELECT 'West Ward-Moriba T' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.95119138 AS lat, -11.73604381 AS lon
      UNION ALL
      SELECT 'West Ward-Nikibu -' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.96045109 AS lat, -11.74790957 AS lon
      UNION ALL
      SELECT 'West Ward-Njagboim' AS town, 'Bo Town' AS chiefdom, 'Bo' AS district, 7.95350859 AS lat, -11.74551708 AS lon
      UNION ALL
      SELECT 'Gba-Cha' AS town, 'Bendu-Cha' AS chiefdom, 'Bonthe' AS district, 7.44311458 AS lat, -12.40987803 AS lon
      UNION ALL
      SELECT 'Sokenteh' AS town, 'Bendu-Cha' AS chiefdom, 'Bonthe' AS district, 7.4692395 AS lat, -12.42783951 AS lon
      UNION ALL
      SELECT 'Tissagbe' AS town, 'Bendu-Cha' AS chiefdom, 'Bonthe' AS district, 7.42461768 AS lat, -12.3479385 AS lon
      UNION ALL
      SELECT 'Yallan-gbokie' AS town, 'Bendu-Cha' AS chiefdom, 'Bonthe' AS district, 7.4973224 AS lat, -12.3537459 AS lon
      UNION ALL
      SELECT 'Fikie' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.41246727 AS lat, -11.96615067 AS lon
      UNION ALL
      SELECT 'Gbengain' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.39304893 AS lat, -11.89565831 AS lon
      UNION ALL
      SELECT 'Gbondubum' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.44846677 AS lat, -11.93127875 AS lon
      UNION ALL
      SELECT 'Koimato' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.48830197 AS lat, -12.0189307 AS lon
      UNION ALL
      SELECT 'Lanje' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.50431835 AS lat, -11.91992672 AS lon
      UNION ALL
      SELECT 'Tamba' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.36272476 AS lat, -11.98627835 AS lon
      UNION ALL
      SELECT 'Torma' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.41732525 AS lat, -12.01330713 AS lon
      UNION ALL
      SELECT 'Yargbe' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.372001 AS lat, -11.92872105 AS lon
      UNION ALL
      SELECT 'Yawma' AS town, 'Bum' AS chiefdom, 'Bonthe' AS district, 7.4756471 AS lat, -11.93776413 AS lon
      UNION ALL
      SELECT 'Chepo' AS town, 'Dema' AS chiefdom, 'Bonthe' AS district, 7.5692322 AS lat, -12.92430411 AS lon
      UNION ALL
      SELECT 'Dema' AS town, 'Dema' AS chiefdom, 'Bonthe' AS district, 7.5937327 AS lat, -12.89383667 AS lon
      UNION ALL
      SELECT 'Turtle Islands' AS town, 'Dema' AS chiefdom, 'Bonthe' AS district, 7.578743 AS lat, -12.97652606 AS lon
      UNION ALL
      SELECT 'Yoh' AS town, 'Dema' AS chiefdom, 'Bonthe' AS district, 7.58834077 AS lat, -12.83055899 AS lon
      UNION ALL
      SELECT 'Babum' AS town, 'Imperri' AS chiefdom, 'Bonthe' AS district, 7.77055464 AS lat, -12.3432617 AS lon
      UNION ALL
      SELECT 'Bapus' AS town, 'Imperri' AS chiefdom, 'Bonthe' AS district, 7.6940445 AS lat, -12.44605653 AS lon
      UNION ALL
      SELECT 'Bigo' AS town, 'Imperri' AS chiefdom, 'Bonthe' AS district, 7.69790793 AS lat, -12.28970051 AS lon
      UNION ALL
      SELECT 'Kahekay' AS town, 'Imperri' AS chiefdom, 'Bonthe' AS district, 7.72539416 AS lat, -12.35442259 AS lon
      UNION ALL
      SELECT 'Moimaligie' AS town, 'Imperri' AS chiefdom, 'Bonthe' AS district, 7.60965144 AS lat, -12.34920791 AS lon
      UNION ALL
      SELECT 'Sokrapan' AS town, 'Imperri' AS chiefdom, 'Bonthe' AS district, 7.61673509 AS lat, -12.43829325 AS lon
      UNION ALL
      SELECT 'Basiaka' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.49033543 AS lat, -12.24729691 AS lon
      UNION ALL
      SELECT 'Bayengbe' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.60658654 AS lat, -12.165573 AS lon
      UNION ALL
      SELECT 'Beyinga' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.53952722 AS lat, -12.16042662 AS lon
      UNION ALL
      SELECT 'Falewuja' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.62927008 AS lat, -12.11643155 AS lon
      UNION ALL
      SELECT 'Kumabeh-Kwe' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.63865758 AS lat, -12.16747785 AS lon
      UNION ALL
      SELECT 'Landi-Ngere' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.62876329 AS lat, -12.24807817 AS lon
      UNION ALL
      SELECT 'Sopan-Cleveland' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.56673544 AS lat, -12.21193919 AS lon
      UNION ALL
      SELECT 'Tucker-Nyambe' AS town, 'Jong' AS chiefdom, 'Bonthe' AS district, 7.52945206 AS lat, -12.25506654 AS lon
      UNION ALL
      SELECT 'Ba-Kobotu' AS town, 'Kpanda Kemo' AS chiefdom, 'Bonthe' AS district, 7.62954793 AS lat, -12.01817498 AS lon
      UNION ALL
      SELECT 'Bewoni' AS town, 'Kpanda Kemo' AS chiefdom, 'Bonthe' AS district, 7.56451961 AS lat, -11.99924887 AS lon
      UNION ALL
      SELECT 'Gbonge' AS town, 'Kpanda Kemo' AS chiefdom, 'Bonthe' AS district, 7.65123315 AS lat, -12.05543196 AS lon
      UNION ALL
      SELECT 'Senjehun' AS town, 'Kpanda Kemo' AS chiefdom, 'Bonthe' AS district, 7.53592231 AS lat, -12.0299338 AS lon
      UNION ALL
      SELECT 'Sewama' AS town, 'Kpanda Kemo' AS chiefdom, 'Bonthe' AS district, 7.62589016 AS lat, -12.04223665 AS lon
      UNION ALL
      SELECT 'Taokunor' AS town, 'Kpanda Kemo' AS chiefdom, 'Bonthe' AS district, 7.57155463 AS lat, -12.03961287 AS lon
      UNION ALL
      SELECT 'Kpanga Koimato' AS town, 'Kwamebai Krim' AS chiefdom, 'Bonthe' AS district, 7.25332637 AS lat, -11.92156742 AS lon
      UNION ALL
      SELECT 'Kwako Lanten' AS town, 'Kwamebai Krim' AS chiefdom, 'Bonthe' AS district, 7.31775793 AS lat, -11.99144854 AS lon
      UNION ALL
      SELECT 'Massa Settie' AS town, 'Kwamebai Krim' AS chiefdom, 'Bonthe' AS district, 7.22265865 AS lat, -11.97809142 AS lon
      UNION ALL
      SELECT 'Mosenten Sahen II' AS town, 'Kwamebai Krim' AS chiefdom, 'Bonthe' AS district, 7.31318001 AS lat, -12.03493091 AS lon
      UNION ALL
      SELECT 'Tubla' AS town, 'Kwamebai Krim' AS chiefdom, 'Bonthe' AS district, 7.30718151 AS lat, -11.93241247 AS lon
      UNION ALL
      SELECT 'Tun-Tun Sullay' AS town, 'Kwamebai Krim' AS chiefdom, 'Bonthe' AS district, 7.27056699 AS lat, -12.05499687 AS lon
      UNION ALL
      SELECT 'Yikie Karbay' AS town, 'Kwamebai Krim' AS chiefdom, 'Bonthe' AS district, 7.26398362 AS lat, -11.98065125 AS lon
      UNION ALL
      SELECT 'Baoma' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.45298611 AS lat, -12.22394466 AS lon
      UNION ALL
      SELECT 'Bohol' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.39115025 AS lat, -12.46250458 AS lon
      UNION ALL
      SELECT 'Bullom' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.40641683 AS lat, -12.29489061 AS lon
      UNION ALL
      SELECT 'Garinga' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.3716373 AS lat, -12.36508 AS lon
      UNION ALL
      SELECT 'Gbangbassa' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.35430784 AS lat, -12.15767108 AS lon
      UNION ALL
      SELECT 'Gbap' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.39246521 AS lat, -12.25100043 AS lon
      UNION ALL
      SELECT 'Hahun' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.35418886 AS lat, -12.11936846 AS lon
      UNION ALL
      SELECT 'Kessie' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.29279554 AS lat, -12.11249253 AS lon
      UNION ALL
      SELECT 'Manyime' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.39885504 AS lat, -12.20614157 AS lon
      UNION ALL
      SELECT 'Pelewahun' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.44607992 AS lat, -12.28147291 AS lon
      UNION ALL
      SELECT 'Salma' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.35682633 AS lat, -12.09180528 AS lon
      UNION ALL
      SELECT 'Solon' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.34962796 AS lat, -12.27568461 AS lon
      UNION ALL
      SELECT 'Torma Subu' AS town, 'Nongoba Bullom' AS chiefdom, 'Bonthe' AS district, 7.31912011 AS lat, -12.21941415 AS lon
      UNION ALL
      SELECT 'Bamba' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.4152856 AS lat, -12.55007705 AS lon
      UNION ALL
      SELECT 'Gonoh' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.5793049 AS lat, -12.54044974 AS lon
      UNION ALL
      SELECT 'Kamai' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.5951228 AS lat, -12.75248961 AS lon
      UNION ALL
      SELECT 'Kwalloh' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.6039944 AS lat, -12.67086968 AS lon
      UNION ALL
      SELECT 'Moh' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.5602119 AS lat, -12.6205028 AS lon
      UNION ALL
      SELECT 'Ngepay' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.48970937 AS lat, -12.63310162 AS lon
      UNION ALL
      SELECT 'Saama' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.61457995 AS lat, -12.60210342 AS lon
      UNION ALL
      SELECT 'Sahaya' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.54660149 AS lat, -12.77477095 AS lon
      UNION ALL
      SELECT 'Sahn-Gbegu' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.46918081 AS lat, -12.55770963 AS lon
      UNION ALL
      SELECT 'Sampoh' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.5590481 AS lat, -12.68539659 AS lon
      UNION ALL
      SELECT 'Yoni' AS town, 'Sittia' AS chiefdom, 'Bonthe' AS district, 7.4896186 AS lat, -12.53417829 AS lon
      UNION ALL
      SELECT 'Bakumba' AS town, 'Sogbeni' AS chiefdom, 'Bonthe' AS district, 7.59908819 AS lat, -12.0723325 AS lon
      UNION ALL
      SELECT 'Beyorgboh' AS town, 'Sogbeni' AS chiefdom, 'Bonthe' AS district, 7.53275905 AS lat, -12.10822023 AS lon
      UNION ALL
      SELECT 'Ndopie' AS town, 'Sogbeni' AS chiefdom, 'Bonthe' AS district, 7.48133549 AS lat, -12.09898587 AS lon
      UNION ALL
      SELECT 'Pengor' AS town, 'Sogbeni' AS chiefdom, 'Bonthe' AS district, 7.56005644 AS lat, -12.08405428 AS lon
      UNION ALL
      SELECT 'Baryegbe' AS town, 'Yawbeko' AS chiefdom, 'Bonthe' AS district, 7.42732916 AS lat, -12.15897982 AS lon
      UNION ALL
      SELECT 'Hahun' AS town, 'Yawbeko' AS chiefdom, 'Bonthe' AS district, 7.47204303 AS lat, -12.14222311 AS lon
      UNION ALL
      SELECT 'Ketaway' AS town, 'Yawbeko' AS chiefdom, 'Bonthe' AS district, 7.42492692 AS lat, -12.10957453 AS lon
      UNION ALL
      SELECT 'Mobulie' AS town, 'Yawbeko' AS chiefdom, 'Bonthe' AS district, 7.51144339 AS lat, -12.17086038 AS lon
      UNION ALL
      SELECT 'Yorma' AS town, 'Yawbeko' AS chiefdom, 'Bonthe' AS district, 7.39370274 AS lat, -12.07602304 AS lon
      UNION ALL
      SELECT 'Bonthe Town' AS town, 'Bonthe Urban' AS chiefdom, 'Bonthe' AS district, 7.5340505 AS lat, -12.51850697 AS lon
      UNION ALL
      SELECT 'Benduma' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.91401901 AS lat, -12.48506436 AS lon
      UNION ALL
      SELECT 'Benkeh' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.7886377 AS lat, -12.51135573 AS lon
      UNION ALL
      SELECT 'Kawaya' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.95992609 AS lat, -12.32121174 AS lon
      UNION ALL
      SELECT 'Kigbai' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.9004333 AS lat, -12.56639889 AS lon
      UNION ALL
      SELECT 'Mani' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.98970892 AS lat, -12.53938265 AS lon
      UNION ALL
      SELECT 'Mokassi' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.99161248 AS lat, -12.38438322 AS lon
      UNION ALL
      SELECT 'Moseilolo' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.84539083 AS lat, -12.45177819 AS lon
      UNION ALL
      SELECT 'Palima' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.9118236 AS lat, -12.35955381 AS lon
      UNION ALL
      SELECT 'Sembehun' AS town, 'Bagruwa' AS chiefdom, 'Moyamba' AS district, 7.97243403 AS lat, -12.47750203 AS lon
      UNION ALL
      SELECT 'Bellentin' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.13100019 AS lat, -12.77585201 AS lon
      UNION ALL
      SELECT 'Bumpeh' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.17801834 AS lat, -12.67713493 AS lon
      UNION ALL
      SELECT 'Greema' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.25799839 AS lat, -12.66213316 AS lon
      UNION ALL
      SELECT 'Kassipoto' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.16507407 AS lat, -12.75231843 AS lon
      UNION ALL
      SELECT 'Mamu' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.05047923 AS lat, -12.73685524 AS lon
      UNION ALL
      SELECT 'Massah' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.06595689 AS lat, -12.58423186 AS lon
      UNION ALL
      SELECT 'Moforay' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.07827133 AS lat, -12.68750954 AS lon
      UNION ALL
      SELECT 'Mokebbie' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.20895828 AS lat, -12.72297219 AS lon
      UNION ALL
      SELECT 'Motobon' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.1195917 AS lat, -12.8252695 AS lon
      UNION ALL
      SELECT 'Moyemi' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.02839783 AS lat, -12.67995617 AS lon
      UNION ALL
      SELECT 'Saiama' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.23850424 AS lat, -12.69299701 AS lon
      UNION ALL
      SELECT 'Samu' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.06113921 AS lat, -12.84647331 AS lon
      UNION ALL
      SELECT 'Yengessa' AS town, 'Bumpeh' AS chiefdom, 'Moyamba' AS district, 8.13721705 AS lat, -12.64228011 AS lon
      UNION ALL
      SELECT 'Bambuibu Tommy' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 7.97779916 AS lat, -12.15444679 AS lon
      UNION ALL
      SELECT 'Bongoya' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.03462069 AS lat, -12.22482411 AS lon
      UNION ALL
      SELECT 'Domboma' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.05957953 AS lat, -12.07294523 AS lon
      UNION ALL
      SELECT 'Foya Tewei' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 7.98127318 AS lat, -12.20285522 AS lon
      UNION ALL
      SELECT 'Jayahun' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.00359252 AS lat, -12.09326136 AS lon
      UNION ALL
      SELECT 'Kenema' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.06693377 AS lat, -12.11742067 AS lon
      UNION ALL
      SELECT 'Mano' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.03404488 AS lat, -12.0926484 AS lon
      UNION ALL
      SELECT 'Niti Korley' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.06598199 AS lat, -12.14922544 AS lon
      UNION ALL
      SELECT 'Semabu' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.00457012 AS lat, -12.05612494 AS lon
      UNION ALL
      SELECT 'Taninahun Gomoh' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.05794172 AS lat, -12.23415588 AS lon
      UNION ALL
      SELECT 'Taninahun Kapuima' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.00772325 AS lat, -12.22688235 AS lon
      UNION ALL
      SELECT 'Timindi' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 8.01026752 AS lat, -12.13566883 AS lon
      UNION ALL
      SELECT 'Wonkifore' AS town, 'Dasse' AS chiefdom, 'Moyamba' AS district, 7.92938947 AS lat, -12.17753565 AS lon
      UNION ALL
      SELECT 'Fakoi' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.22327216 AS lat, -12.34154599 AS lon
      UNION ALL
      SELECT 'Gandorhun Central' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.23616204 AS lat, -12.34080349 AS lon
      UNION ALL
      SELECT 'Kovella' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.27502705 AS lat, -12.42502571 AS lon
      UNION ALL
      SELECT 'Kpangulgo' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.29420768 AS lat, -12.36006235 AS lon
      UNION ALL
      SELECT 'Kunyafoi' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.2623752 AS lat, -12.29774352 AS lon
      UNION ALL
      SELECT 'Maninga' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.31994887 AS lat, -12.27930217 AS lon
      UNION ALL
      SELECT 'Njawa' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.15899644 AS lat, -12.24596407 AS lon
      UNION ALL
      SELECT 'Songo' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.22696076 AS lat, -12.25253542 AS lon
      UNION ALL
      SELECT 'Tangbla' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.30247762 AS lat, -12.33470017 AS lon
      UNION ALL
      SELECT 'To - Ndambalenga' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.30777552 AS lat, -12.23658848 AS lon
      UNION ALL
      SELECT 'Tullu' AS town, 'Fakunya' AS chiefdom, 'Moyamba' AS district, 8.16936167 AS lat, -12.31536988 AS lon
      UNION ALL
      SELECT 'Bendu A' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.87363856 AS lat, -12.90588834 AS lon
      UNION ALL
      SELECT 'Bendu B' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.84609923 AS lat, -12.78744991 AS lon
      UNION ALL
      SELECT 'Bumpetoke' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.81485254 AS lat, -12.83015249 AS lon
      UNION ALL
      SELECT 'Gbuallay' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.98910369 AS lat, -12.6223948 AS lon
      UNION ALL
      SELECT 'Konolor' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.91940332 AS lat, -12.7293886 AS lon
      UNION ALL
      SELECT 'Mambo' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.97327655 AS lat, -12.77556565 AS lon
      UNION ALL
      SELECT 'Mano' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.8481273 AS lat, -12.8659682 AS lon
      UNION ALL
      SELECT 'Mobeh' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.96263418 AS lat, -12.68151761 AS lon
      UNION ALL
      SELECT 'Mofuss' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.9738979 AS lat, -12.71729354 AS lon
      UNION ALL
      SELECT 'Mokandor' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.87994817 AS lat, -12.68962704 AS lon
      UNION ALL
      SELECT 'Mokebe' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.89643677 AS lat, -12.80360718 AS lon
      UNION ALL
      SELECT 'Mokobo' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.93899224 AS lat, -12.63830597 AS lon
      UNION ALL
      SELECT 'Mopaileh' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.84938471 AS lat, -12.72723422 AS lon
      UNION ALL
      SELECT 'Moyah' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.98330762 AS lat, -12.82569024 AS lon
      UNION ALL
      SELECT 'Moyibo' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.97867632 AS lat, -12.59697876 AS lon
      UNION ALL
      SELECT 'Ngiehun' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.98491584 AS lat, -12.65766101 AS lon
      UNION ALL
      SELECT 'Rembe' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 8.02656647 AS lat, -12.86522172 AS lon
      UNION ALL
      SELECT 'Tassoh' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.909371 AS lat, -12.89333813 AS lon
      UNION ALL
      SELECT 'Thumba A' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.86961177 AS lat, -12.86722782 AS lon
      UNION ALL
      SELECT 'Thumba B' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.86660903 AS lat, -12.74911616 AS lon
      UNION ALL
      SELECT 'Yondu' AS town, 'Kagboro' AS chiefdom, 'Moyamba' AS district, 7.99326067 AS lat, -12.86452125 AS lon
      UNION ALL
      SELECT 'Angigboya' AS town, 'Kaiyamba' AS chiefdom, 'Moyamba' AS district, 8.04231838 AS lat, -12.35454464 AS lon
      UNION ALL
      SELECT 'Koromboya' AS town, 'Kaiyamba' AS chiefdom, 'Moyamba' AS district, 8.12912924 AS lat, -12.44299043 AS lon
      UNION ALL
      SELECT 'Kpange' AS town, 'Kaiyamba' AS chiefdom, 'Moyamba' AS district, 8.05717434 AS lat, -12.45142618 AS lon
      UNION ALL
      SELECT 'Lungili' AS town, 'Kaiyamba' AS chiefdom, 'Moyamba' AS district, 8.12423119 AS lat, -12.35346661 AS lon
      UNION ALL
      SELECT 'Mendegelema' AS town, 'Kaiyamba' AS chiefdom, 'Moyamba' AS district, 8.2002406 AS lat, -12.47221725 AS lon
      UNION ALL
      SELECT 'Mosoe' AS town, 'Kaiyamba' AS chiefdom, 'Moyamba' AS district, 8.19809073 AS lat, -12.41113816 AS lon
      UNION ALL
      SELECT 'Waliwahun' AS town, 'Kaiyamba' AS chiefdom, 'Moyamba' AS district, 8.07635279 AS lat, -12.28979022 AS lon
      UNION ALL
      SELECT 'Kowama' AS town, 'Kamajei' AS chiefdom, 'Moyamba' AS district, 8.30497891 AS lat, -11.91901853 AS lon
      UNION ALL
      SELECT 'Mogbuama' AS town, 'Kamajei' AS chiefdom, 'Moyamba' AS district, 8.22707536 AS lat, -11.91930011 AS lon
      UNION ALL
      SELECT 'Ngiegombu' AS town, 'Kamajei' AS chiefdom, 'Moyamba' AS district, 8.1152428 AS lat, -12.00633582 AS lon
      UNION ALL
      SELECT 'Ngoahun' AS town, 'Kamajei' AS chiefdom, 'Moyamba' AS district, 8.22370871 AS lat, -11.83845644 AS lon
      UNION ALL
      SELECT 'Njagbema' AS town, 'Kamajei' AS chiefdom, 'Moyamba' AS district, 8.34293294 AS lat, -11.90989276 AS lon
      UNION ALL
      SELECT 'Tawovehun' AS town, 'Kamajei' AS chiefdom, 'Moyamba' AS district, 8.16035894 AS lat, -11.95634299 AS lon
      UNION ALL
      SELECT 'Yeima' AS town, 'Kamajei' AS chiefdom, 'Moyamba' AS district, 8.32235164 AS lat, -11.83409075 AS lon
      UNION ALL
      SELECT 'Gibina' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.18618693 AS lat, -12.57133777 AS lon
      UNION ALL
      SELECT 'Gondama' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.13333251 AS lat, -12.50113239 AS lon
      UNION ALL
      SELECT 'Mobonor' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.07392039 AS lat, -12.54368717 AS lon
      UNION ALL
      SELECT 'Mokorewo' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.23501161 AS lat, -12.5045991 AS lon
      UNION ALL
      SELECT 'Mongere' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.24709014 AS lat, -12.60281422 AS lon
      UNION ALL
      SELECT 'Mosongla' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.0750833 AS lat, -12.49951852 AS lon
      UNION ALL
      SELECT 'Mowoto' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.16240952 AS lat, -12.52985313 AS lon
      UNION ALL
      SELECT 'Senehun' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.14393197 AS lat, -12.59421743 AS lon
      UNION ALL
      SELECT 'Taninihun' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.11588633 AS lat, -12.55256791 AS lon
      UNION ALL
      SELECT 'Tongieh' AS town, 'Kongbora' AS chiefdom, 'Moyamba' AS district, 8.23495456 AS lat, -12.5560825 AS lon
      UNION ALL
      SELECT 'Zone - 1' AS town, 'Kori' AS chiefdom, 'Moyamba' AS district, 8.32131285 AS lat, -12.01404258 AS lon
      UNION ALL
      SELECT 'Zone - 2' AS town, 'Kori' AS chiefdom, 'Moyamba' AS district, 8.237665 AS lat, -11.99776881 AS lon
      UNION ALL
      SELECT 'Zone - 3' AS town, 'Kori' AS chiefdom, 'Moyamba' AS district, 8.27513618 AS lat, -12.14544793 AS lon
      UNION ALL
      SELECT 'Zone - 4' AS town, 'Kori' AS chiefdom, 'Moyamba' AS district, 8.2033006 AS lat, -12.14779371 AS lon
      UNION ALL
      SELECT 'Zone - 5' AS town, 'Kori' AS chiefdom, 'Moyamba' AS district, 8.14501169 AS lat, -12.15577104 AS lon
      UNION ALL
      SELECT 'Zone - 6' AS town, 'Kori' AS chiefdom, 'Moyamba' AS district, 8.09648325 AS lat, -12.21340986 AS lon
      UNION ALL
      SELECT 'Zone - 7' AS town, 'Kori' AS chiefdom, 'Moyamba' AS district, 8.14890531 AS lat, -12.04111271 AS lon
      UNION ALL
      SELECT 'Kpandobu' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.03338472 AS lat, -11.9135226 AS lon
      UNION ALL
      SELECT 'Moforay' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.01837101 AS lat, -12.0038456 AS lon
      UNION ALL
      SELECT 'Mosumana' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.07584689 AS lat, -12.01325035 AS lon
      UNION ALL
      SELECT 'Ngiyeiya' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.05154069 AS lat, -11.99728213 AS lon
      UNION ALL
      SELECT 'Njagbahun' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.13444503 AS lat, -11.91491294 AS lon
      UNION ALL
      SELECT 'Njama' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.08804163 AS lat, -11.93076548 AS lon
      UNION ALL
      SELECT 'Tabe' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.02013181 AS lat, -11.94988632 AS lon
      UNION ALL
      SELECT 'Tawoveihun' AS town, 'Kowa' AS chiefdom, 'Moyamba' AS district, 8.07657262 AS lat, -11.96711883 AS lon
      UNION ALL
      SELECT 'Bengelloh' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.8619479 AS lat, -12.38119955 AS lon
      UNION ALL
      SELECT 'Gbangbatoke' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.8315115 AS lat, -12.35931978 AS lon
      UNION ALL
      SELECT 'Largoh' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.83962546 AS lat, -12.30284394 AS lon
      UNION ALL
      SELECT 'Mofindoh' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.83836435 AS lat, -12.24674886 AS lon
      UNION ALL
      SELECT 'Mokotawa' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.89734948 AS lat, -12.16601703 AS lon
      UNION ALL
      SELECT 'Ndendemoya' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.77791904 AS lat, -12.25349203 AS lon
      UNION ALL
      SELECT 'Ngolala' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.91083012 AS lat, -12.2098141 AS lon
      UNION ALL
      SELECT 'Njagbahun' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.93951833 AS lat, -12.25561985 AS lon
      UNION ALL
      SELECT 'Wulbange' AS town, 'Lower Banta' AS chiefdom, 'Moyamba' AS district, 7.84988094 AS lat, -12.1768985 AS lon
      UNION ALL
      SELECT 'Kentineh' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.28330847 AS lat, -12.80638143 AS lon
      UNION ALL
      SELECT 'Lower Ribbi' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.2199678 AS lat, -12.93318215 AS lon
      UNION ALL
      SELECT 'Makera' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.36344871 AS lat, -12.78600503 AS lon
      UNION ALL
      SELECT 'Masanka' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.3464555 AS lat, -12.83353889 AS lon
      UNION ALL
      SELECT 'Masarakulay' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.32455068 AS lat, -12.6637036 AS lon
      UNION ALL
      SELECT 'Mobureh' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.15215195 AS lat, -12.89365528 AS lon
      UNION ALL
      SELECT 'Motoni' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.29772339 AS lat, -12.73639624 AS lon
      UNION ALL
      SELECT 'Motonkoh' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.25366038 AS lat, -12.83797384 AS lon
      UNION ALL
      SELECT 'Upper Ribbi' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.20611875 AS lat, -12.85029153 AS lon
      UNION ALL
      SELECT 'Yoni' AS town, 'Ribbi' AS chiefdom, 'Moyamba' AS district, 8.22740245 AS lat, -12.7828226 AS lon
      UNION ALL
      SELECT 'Bembellor' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.73645075 AS lat, -12.70834234 AS lon
      UNION ALL
      SELECT 'Gambia' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.79242082 AS lat, -12.7045582 AS lon
      UNION ALL
      SELECT 'Gbehan' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.76726477 AS lat, -12.5874087 AS lon
      UNION ALL
      SELECT 'Kamasunu' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.77178575 AS lat, -12.64194673 AS lon
      UNION ALL
      SELECT 'Kambotoke' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.81728104 AS lat, -12.62716648 AS lon
      UNION ALL
      SELECT 'Kebail' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.75034199 AS lat, -12.73116993 AS lon
      UNION ALL
      SELECT 'Mandu' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.78138012 AS lat, -12.75395105 AS lon
      UNION ALL
      SELECT 'Mye' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.77325077 AS lat, -12.67700953 AS lon
      UNION ALL
      SELECT 'Nonkoba' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.72495748 AS lat, -12.64311545 AS lon
      UNION ALL
      SELECT 'Sahan' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.73205719 AS lat, -12.67701632 AS lon
      UNION ALL
      SELECT 'Tombeh' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.8055503 AS lat, -12.67848755 AS lon
      UNION ALL
      SELECT 'Yapoma' AS town, 'Timdale' AS chiefdom, 'Moyamba' AS district, 7.88001423 AS lat, -12.63735023 AS lon
      UNION ALL
      SELECT 'Bei-Kelleh' AS town, 'Upper Banta' AS chiefdom, 'Moyamba' AS district, 7.73835166 AS lat, -12.15531508 AS lon
      UNION ALL
      SELECT 'Kenafallay' AS town, 'Upper Banta' AS chiefdom, 'Moyamba' AS district, 7.75500006 AS lat, -12.22573257 AS lon
      UNION ALL
      SELECT 'Kepay' AS town, 'Upper Banta' AS chiefdom, 'Moyamba' AS district, 7.77488262 AS lat, -12.16958956 AS lon
      UNION ALL
      SELECT 'Mogongbe' AS town, 'Upper Banta' AS chiefdom, 'Moyamba' AS district, 7.69777983 AS lat, -12.13505775 AS lon
      UNION ALL
      SELECT 'Songbo' AS town, 'Upper Banta' AS chiefdom, 'Moyamba' AS district, 7.70092908 AS lat, -12.22570616 AS lon
      UNION ALL
      SELECT 'Dakona' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.40857137 AS lat, -11.37351259 AS lon
      UNION ALL
      SELECT 'Fallay' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.49410606 AS lat, -11.48280485 AS lon
      UNION ALL
      SELECT 'Jougba' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.5897281 AS lat, -11.36978964 AS lon
      UNION ALL
      SELECT 'Karjei' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.51121867 AS lat, -11.39156003 AS lon
      UNION ALL
      SELECT 'Laimba' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.43537592 AS lat, -11.43021314 AS lon
      UNION ALL
      SELECT 'Malla' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.3354969 AS lat, -11.45397676 AS lon
      UNION ALL
      SELECT 'Sonjour I' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.39968743 AS lat, -11.45087747 AS lon
      UNION ALL
      SELECT 'Sonjour II' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.34353448 AS lat, -11.40484498 AS lon
      UNION ALL
      SELECT 'Tetima' AS town, 'Barri' AS chiefdom, 'Pujehun' AS district, 7.49168845 AS lat, -11.42242379 AS lon
      UNION ALL
      SELECT 'Bondor' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.31000817 AS lat, -11.49625643 AS lon
      UNION ALL
      SELECT 'Dabeni' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.26160607 AS lat, -11.55946807 AS lon
      UNION ALL
      SELECT 'Dakona' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.27254878 AS lat, -11.59814619 AS lon
      UNION ALL
      SELECT 'Gendema I' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.12773546 AS lat, -11.56643783 AS lon
      UNION ALL
      SELECT 'Gendema II' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.21211681 AS lat, -11.59015303 AS lon
      UNION ALL
      SELECT 'Jakema I' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.33347355 AS lat, -11.53192118 AS lon
      UNION ALL
      SELECT 'Jakema II' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.20604537 AS lat, -11.56233827 AS lon
      UNION ALL
      SELECT 'Joya' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.43092337 AS lat, -11.54851467 AS lon
      UNION ALL
      SELECT 'Kemokai' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.23681445 AS lat, -11.52268747 AS lon
      UNION ALL
      SELECT 'Kortugbu' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.38986446 AS lat, -11.63341891 AS lon
      UNION ALL
      SELECT 'Mallah' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.35087314 AS lat, -11.48958428 AS lon
      UNION ALL
      SELECT 'Mewah' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.34369581 AS lat, -11.64018699 AS lon
      UNION ALL
      SELECT 'Pelegbulor' AS town, 'Galliness Perri' AS chiefdom, 'Pujehun' AS district, 7.33209704 AS lat, -11.56305442 AS lon
      UNION ALL
      SELECT 'Jassende Kpeima' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.04214151 AS lat, -11.5968999 AS lon
      UNION ALL
      SELECT 'Jassende Masaoma' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.21478132 AS lat, -11.6301607 AS lon
      UNION ALL
      SELECT 'Jassende Ngoleima' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.32069983 AS lat, -11.67316508 AS lon
      UNION ALL
      SELECT 'Jassende Ngoleima' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.41750653 AS lat, -11.61383659 AS lon
      UNION ALL
      SELECT 'Nyango - Njeigbla' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.17842644 AS lat, -11.66940164 AS lon
      UNION ALL
      SELECT 'Nyango-Ngoleihun' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.27896294 AS lat, -11.64192212 AS lon
      UNION ALL
      SELECT 'Parvu' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.01607148 AS lat, -11.58653226 AS lon
      UNION ALL
      SELECT 'Sarbah' AS town, 'Kpaka' AS chiefdom, 'Pujehun' AS district, 7.10309031 AS lat, -11.64659287 AS lon
      UNION ALL
      SELECT 'Bakoi' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.45562016 AS lat, -11.6816755 AS lon
      UNION ALL
      SELECT 'Banyande' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.360795 AS lat, -11.82697347 AS lon
      UNION ALL
      SELECT 'Kabonde' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.53796761 AS lat, -11.60797415 AS lon
      UNION ALL
      SELECT 'Kondogbe' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.45385992 AS lat, -11.73516336 AS lon
      UNION ALL
      SELECT 'Lower Kayiemba' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.33220491 AS lat, -11.6994341 AS lon
      UNION ALL
      SELECT 'Panga' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.31032866 AS lat, -11.73482124 AS lon
      UNION ALL
      SELECT 'Pessekeh' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.39566703 AS lat, -11.79961663 AS lon
      UNION ALL
      SELECT 'Samba' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.4583173 AS lat, -11.61408679 AS lon
      UNION ALL
      SELECT 'Setti-Yakanday' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.30209743 AS lat, -11.85803397 AS lon
      UNION ALL
      SELECT 'Upper Kayiemba' AS town, 'Panga Kabonde' AS chiefdom, 'Pujehun' AS district, 7.42726081 AS lat, -11.75925433 AS lon
      UNION ALL
      SELECT 'Kengo' AS town, 'Makpele' AS chiefdom, 'Pujehun' AS district, 7.24957393 AS lat, -11.34382295 AS lon
      UNION ALL
      SELECT 'Samagbe' AS town, 'Makpele' AS chiefdom, 'Pujehun' AS district, 7.28377427 AS lat, -11.23757786 AS lon
      UNION ALL
      SELECT 'Seitua' AS town, 'Makpele' AS chiefdom, 'Pujehun' AS district, 7.26486505 AS lat, -11.39278064 AS lon
      UNION ALL
      SELECT 'Selimeh' AS town, 'Makpele' AS chiefdom, 'Pujehun' AS district, 7.34687443 AS lat, -11.30826148 AS lon
      UNION ALL
      SELECT 'Bahoin' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.43886728 AS lat, -11.87574595 AS lon
      UNION ALL
      SELECT 'Kahaimoh' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.6002001 AS lat, -11.75292982 AS lon
      UNION ALL
      SELECT 'Kakpanda' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.56168641 AS lat, -11.80917679 AS lon
      UNION ALL
      SELECT 'Kemoh' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.44924882 AS lat, -11.79520785 AS lon
      UNION ALL
      SELECT 'Korwa' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.45445954 AS lat, -11.8209629 AS lon
      UNION ALL
      SELECT 'Lower Pemba' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.51963664 AS lat, -11.83288268 AS lon
      UNION ALL
      SELECT 'Seijeila' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.38445592 AS lat, -11.86478837 AS lon
      UNION ALL
      SELECT 'Taukunor' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.48165138 AS lat, -11.85238684 AS lon
      UNION ALL
      SELECT 'Upper Pemba' AS town, 'Malen' AS chiefdom, 'Pujehun' AS district, 7.52490744 AS lat, -11.77522103 AS lon
      UNION ALL
      SELECT 'Gbomotie' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.20192254 AS lat, -11.71051501 AS lon
      UNION ALL
      SELECT 'Kemoh' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.16088548 AS lat, -11.79379756 AS lon
      UNION ALL
      SELECT 'Makpondo' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.14491556 AS lat, -11.66928293 AS lon
      UNION ALL
      SELECT 'Masanda Majagbe' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.11160595 AS lat, -11.75004848 AS lon
      UNION ALL
      SELECT 'Pembaar' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.18955998 AS lat, -11.90747184 AS lon
      UNION ALL
      SELECT 'Pullie' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.17860272 AS lat, -11.69537376 AS lon
      UNION ALL
      SELECT 'Sitta' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.08764855 AS lat, -11.69487877 AS lon
      UNION ALL
      SELECT 'Sowa' AS town, 'Mono Sakrim' AS chiefdom, 'Pujehun' AS district, 7.15602636 AS lat, -11.83760051 AS lon
      UNION ALL
      SELECT 'Fassei' AS town, 'Panga krim' AS chiefdom, 'Pujehun' AS district, 7.28343626 AS lat, -11.78035374 AS lon
      UNION ALL
      SELECT 'Pemagbie' AS town, 'Panga krim' AS chiefdom, 'Pujehun' AS district, 7.3821124 AS lat, -11.71464912 AS lon
      UNION ALL
      SELECT 'Samba' AS town, 'Panga krim' AS chiefdom, 'Pujehun' AS district, 7.39092676 AS lat, -11.6969027 AS lon
      UNION ALL
      SELECT 'Somasa' AS town, 'Panga krim' AS chiefdom, 'Pujehun' AS district, 7.28627848 AS lat, -11.80610842 AS lon
      UNION ALL
      SELECT 'Koilenga' AS town, 'Pejeh(Futa peje' AS chiefdom, 'Pujehun' AS district, 7.60637812 AS lat, -11.51041053 AS lon
      UNION ALL
      SELECT 'Pejeh East' AS town, 'Pejeh(Futa peje' AS chiefdom, 'Pujehun' AS district, 7.56219827 AS lat, -11.55904006 AS lon
      UNION ALL
      SELECT 'Pejeh West' AS town, 'Pejeh(Futa peje' AS chiefdom, 'Pujehun' AS district, 7.51803909 AS lat, -11.55430303 AS lon
      UNION ALL
      SELECT 'Kemokai' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.04383125 AS lat, -11.40070178 AS lon
      UNION ALL
      SELECT 'Kengo' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.17431222 AS lat, -11.47925446 AS lon
      UNION ALL
      SELECT 'Kiazombo' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.1584702 AS lat, -11.34037908 AS lon
      UNION ALL
      SELECT 'Mano - River' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 6.97390089 AS lat, -11.46223444 AS lon
      UNION ALL
      SELECT 'Massaquoi I' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.12189944 AS lat, -11.48978533 AS lon
      UNION ALL
      SELECT 'Massaquoi II' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.00066392 AS lat, -11.52193666 AS lon
      UNION ALL
      SELECT 'Moiwebu' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.06977966 AS lat, -11.49506258 AS lon
      UNION ALL
      SELECT 'Zoker I' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.14122721 AS lat, -11.40825784 AS lon
      UNION ALL
      SELECT 'Zoker II' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.22379862 AS lat, -11.39587506 AS lon
      UNION ALL
      SELECT 'Zombo' AS town, 'Soro Gbema' AS chiefdom, 'Pujehun' AS district, 7.25962739 AS lat, -11.47246508 AS lon
      UNION ALL
      SELECT 'Lower Geoma' AS town, 'Sowa' AS chiefdom, 'Pujehun' AS district, 7.51314263 AS lat, -11.72961448 AS lon
      UNION ALL
      SELECT 'Sabba I' AS town, 'Sowa' AS chiefdom, 'Pujehun' AS district, 7.59724153 AS lat, -11.64287962 AS lon
      UNION ALL
      SELECT 'Sabba II' AS town, 'Sowa' AS chiefdom, 'Pujehun' AS district, 7.63388474 AS lat, -11.54973482 AS lon
      UNION ALL
      SELECT 'Upper Geoma' AS town, 'Sowa' AS chiefdom, 'Pujehun' AS district, 7.52989056 AS lat, -11.67060325 AS lon
      UNION ALL
      SELECT 'Bagollay' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.19026541 AS lat, -11.76938352 AS lon
      UNION ALL
      SELECT 'Bapawa' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.26779421 AS lat, -11.75642696 AS lon
      UNION ALL
      SELECT 'Batowa' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.23825139 AS lat, -11.68446251 AS lon
      UNION ALL
      SELECT 'Bekowa' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.25393596 AS lat, -11.83293496 AS lon
      UNION ALL
      SELECT 'Deyombo' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.23203439 AS lat, -11.65455357 AS lon
      UNION ALL
      SELECT 'Fortune' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.22541575 AS lat, -11.80988231 AS lon
      UNION ALL
      SELECT 'Kemo-Bo' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.18775043 AS lat, -11.74457918 AS lon
      UNION ALL
      SELECT 'Kemo-wa' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.16680433 AS lat, -11.75852295 AS lon
      UNION ALL
      SELECT 'Kpukumu' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.22197361 AS lat, -11.75485431 AS lon
      UNION ALL
      SELECT 'Seiwoh' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.19773744 AS lat, -11.82493855 AS lon
      UNION ALL
      SELECT 'Sowonde' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.2333397 AS lat, -11.88192647 AS lon
      UNION ALL
      SELECT 'Yabai' AS town, 'Yakemu Kpukumu' AS chiefdom, 'Pujehun' AS district, 7.23355038 AS lat, -11.84798767 AS lon
      UNION ALL
      SELECT 'Fabaina Area' AS town, 'Koya Rural' AS chiefdom, 'Western Area Rural' AS district, 8.30643101 AS lat, -12.93531347 AS lon
      UNION ALL
      SELECT 'Madonkeh' AS town, 'Koya Rural' AS chiefdom, 'Western Area Rural' AS district, 8.3652991 AS lat, -13.01095642 AS lon
      UNION ALL
      SELECT 'Magbafti' AS town, 'Koya Rural' AS chiefdom, 'Western Area Rural' AS district, 8.28049322 AS lat, -12.99178212 AS lon
      UNION ALL
      SELECT 'Malambay' AS town, 'Koya Rural' AS chiefdom, 'Western Area Rural' AS district, 8.30558857 AS lat, -13.02900079 AS lon
      UNION ALL
      SELECT 'Newton' AS town, 'Koya Rural' AS chiefdom, 'Western Area Rural' AS district, 8.33609354 AS lat, -12.9947121 AS lon
      UNION ALL
      SELECT 'Songo' AS town, 'Koya Rural' AS chiefdom, 'Western Area Rural' AS district, 8.34699158 AS lat, -12.95844293 AS lon
      UNION ALL
      SELECT 'Bathurst' AS town, 'Mountain Rural' AS chiefdom, 'Western Area Rural' AS district, 8.43045874 AS lat, -13.20073162 AS lon
      UNION ALL
      SELECT 'Charlotte' AS town, 'Mountain Rural' AS chiefdom, 'Western Area Rural' AS district, 8.41119936 AS lat, -13.19168746 AS lon
      UNION ALL
      SELECT 'Gloucester' AS town, 'Mountain Rural' AS chiefdom, 'Western Area Rural' AS district, 8.45312204 AS lat, -13.20940277 AS lon
      UNION ALL
      SELECT 'Leicester' AS town, 'Mountain Rural' AS chiefdom, 'Western Area Rural' AS district, 8.46446793 AS lat, -13.22028031 AS lon
      UNION ALL
      SELECT 'Regent' AS town, 'Mountain Rural' AS chiefdom, 'Western Area Rural' AS district, 8.44171144 AS lat, -13.2296262 AS lon
      UNION ALL
      SELECT 'Benguema Village A' AS town, 'Waterloo Rural' AS chiefdom, 'Western Area Rural' AS district, 8.29811664 AS lat, -13.08533892 AS lon
      UNION ALL
      SELECT 'Campbell Town Vill' AS town, 'Waterloo Rural' AS chiefdom, 'Western Area Rural' AS district, 8.29181102 AS lat, -13.05400056 AS lon
      UNION ALL
      SELECT 'Hastings Village A' AS town, 'Waterloo Rural' AS chiefdom, 'Western Area Rural' AS district, 8.35362747 AS lat, -13.11871257 AS lon
      UNION ALL
      SELECT 'Waterloo Village A' AS town, 'Waterloo Rural' AS chiefdom, 'Western Area Rural' AS district, 8.34712474 AS lat, -13.05658698 AS lon
      UNION ALL
      SELECT 'Gbendembu' AS town, 'York Rural' AS chiefdom, 'Western Area Rural' AS district, 8.43128662 AS lat, -13.26476696 AS lon
      UNION ALL
      SELECT 'Goderich-Adonkia/M' AS town, 'York Rural' AS chiefdom, 'Western Area Rural' AS district, 8.42163804 AS lat, -13.25212444 AS lon
      UNION ALL
      SELECT 'Goderich-Funkia' AS town, 'York Rural' AS chiefdom, 'Western Area Rural' AS district, 8.43626133 AS lat, -13.28171563 AS lon
      UNION ALL
      SELECT 'Hamilton' AS town, 'York Rural' AS chiefdom, 'Western Area Rural' AS district, 8.3765798 AS lat, -13.21797027 AS lon
      UNION ALL
      SELECT 'Kent' AS town, 'York Rural' AS chiefdom, 'Western Area Rural' AS district, 8.19493865 AS lat, -13.14599044 AS lon
      UNION ALL
      SELECT 'Sattia/Tombo' AS town, 'York Rural' AS chiefdom, 'Western Area Rural' AS district, 8.23975917 AS lat, -13.08510102 AS lon
      UNION ALL
      SELECT 'York' AS town, 'York Rural' AS chiefdom, 'Western Area Rural' AS district, 8.2849823 AS lat, -13.13096055 AS lon
      UNION ALL
      SELECT 'Albert Academy' AS town, 'Central I' AS chiefdom, 'Western Area Urban' AS district, 8.47696929 AS lat, -13.23266527 AS lon
      UNION ALL
      SELECT 'Mountain Regent' AS town, 'Central I' AS chiefdom, 'Western Area Urban' AS district, 8.48179659 AS lat, -13.22829844 AS lon
      UNION ALL
      SELECT 'Sorie Town' AS town, 'Central I' AS chiefdom, 'Western Area Urban' AS district, 8.47323672 AS lat, -13.22678088 AS lon
      UNION ALL
      SELECT 'Susan''s Bay' AS town, 'Central I' AS chiefdom, 'Western Area Urban' AS district, 8.48889635 AS lat, -13.22994613 AS lon
      UNION ALL
      SELECT 'Tower Hill' AS town, 'Central I' AS chiefdom, 'Western Area Urban' AS district, 8.48373364 AS lat, -13.23275579 AS lon
      UNION ALL
      SELECT 'Connaught Hospital' AS town, 'Central II' AS chiefdom, 'Western Area Urban' AS district, 8.48901152 AS lat, -13.23613424 AS lon
      UNION ALL
      SELECT 'Sanders Brook' AS town, 'Central II' AS chiefdom, 'Western Area Urban' AS district, 8.4819826 AS lat, -13.23800341 AS lon
      UNION ALL
      SELECT 'Cline Town' AS town, 'East I' AS chiefdom, 'Western Area Urban' AS district, 8.48704603 AS lat, -13.20916702 AS lon
      UNION ALL
      SELECT 'Fourah Bay' AS town, 'East I' AS chiefdom, 'Western Area Urban' AS district, 8.48883079 AS lat, -13.21354111 AS lon
      UNION ALL
      SELECT 'Kossoh Town' AS town, 'East I' AS chiefdom, 'Western Area Urban' AS district, 8.4890527 AS lat, -13.21923758 AS lon
      UNION ALL
      SELECT 'Bombay' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.48501354 AS lat, -13.22235935 AS lon
      UNION ALL
      SELECT 'Coconut Farm/ Asho' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.4781018 AS lat, -13.21338559 AS lon
      UNION ALL
      SELECT 'Foulah Town' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.48356082 AS lat, -13.2252499 AS lon
      UNION ALL
      SELECT 'Ginger Hall' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.48354013 AS lat, -13.21697975 AS lon
      UNION ALL
      SELECT 'Kissy Brook' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.47490045 AS lat, -13.21067336 AS lon
      UNION ALL
      SELECT 'Magazine' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.48945052 AS lat, -13.22419852 AS lon
      UNION ALL
      SELECT 'Mount Aureol' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.48168295 AS lat, -13.22024609 AS lon
      UNION ALL
      SELECT 'Quarry' AS town, 'East II' AS chiefdom, 'Western Area Urban' AS district, 8.48059006 AS lat, -13.21499619 AS lon
      UNION ALL
      SELECT 'Allen Town I' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.42395192 AS lat, -13.16110587 AS lon
      UNION ALL
      SELECT 'Allen Town II' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.41250668 AS lat, -13.15800194 AS lon
      UNION ALL
      SELECT 'Bottom Oku' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.45065291 AS lat, -13.16511338 AS lon
      UNION ALL
      SELECT 'Congo Water I' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.45443864 AS lat, -13.17298415 AS lon
      UNION ALL
      SELECT 'Congo Water II' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.44801579 AS lat, -13.17694599 AS lon
      UNION ALL
      SELECT 'Grass Field' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46799236 AS lat, -13.1783873 AS lon
      UNION ALL
      SELECT 'Industrial Estate' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.43861712 AS lat, -13.18006276 AS lon
      UNION ALL
      SELECT 'Jalloh Terrace' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.45535413 AS lat, -13.18722093 AS lon
      UNION ALL
      SELECT 'Kissy Brook' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46935334 AS lat, -13.20951934 AS lon
      UNION ALL
      SELECT 'Kissy Bye Pass I' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.47868443 AS lat, -13.20237765 AS lon
      UNION ALL
      SELECT 'Kissy Bye Pass II' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.47652665 AS lat, -13.18856309 AS lon
      UNION ALL
      SELECT 'Kissy Mental' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46586614 AS lat, -13.19545637 AS lon
      UNION ALL
      SELECT 'Kissy Mess Mess' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46379523 AS lat, -13.18885723 AS lon
      UNION ALL
      SELECT 'Kuntolor' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.45366776 AS lat, -13.18289827 AS lon
      UNION ALL
      SELECT 'Lowcost Housing' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.4703923 AS lat, -13.18612286 AS lon
      UNION ALL
      SELECT 'Mamba Ridge I' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.4688116 AS lat, -13.20523964 AS lon
      UNION ALL
      SELECT 'Mamba Ridge II' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46617616 AS lat, -13.20053974 AS lon
      UNION ALL
      SELECT 'Mayenkineh' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.43145309 AS lat, -13.1624733 AS lon
      UNION ALL
      SELECT 'Old Warf' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.44586704 AS lat, -13.16112752 AS lon
      UNION ALL
      SELECT 'Pamuronko' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.43485608 AS lat, -13.15322657 AS lon
      UNION ALL
      SELECT 'Portee' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46498403 AS lat, -13.17378481 AS lon
      UNION ALL
      SELECT 'Robis' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.43494541 AS lat, -13.17025033 AS lon
      UNION ALL
      SELECT 'Rokupa' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46063062 AS lat, -13.17226224 AS lon
      UNION ALL
      SELECT 'Shell' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.46807236 AS lat, -13.19153903 AS lon
      UNION ALL
      SELECT 'Thunderhill' AS town, 'East III' AS chiefdom, 'Western Area Urban' AS district, 8.45457227 AS lat, -13.1957772 AS lon
      UNION ALL
      SELECT 'Ascension Town' AS town, 'West I' AS chiefdom, 'Western Area Urban' AS district, 8.48376511 AS lat, -13.24750592 AS lon
      UNION ALL
      SELECT 'Brookfields' AS town, 'West I' AS chiefdom, 'Western Area Urban' AS district, 8.47631176 AS lat, -13.24843849 AS lon
      UNION ALL
      SELECT 'Kingtom' AS town, 'West I' AS chiefdom, 'Western Area Urban' AS district, 8.48902935 AS lat, -13.24802726 AS lon
      UNION ALL
      SELECT 'Kroo Town' AS town, 'West I' AS chiefdom, 'Western Area Urban' AS district, 8.48251324 AS lat, -13.24233269 AS lon
      UNION ALL
      SELECT 'Brookfields-Congo' AS town, 'West II' AS chiefdom, 'Western Area Urban' AS district, 8.47555466 AS lat, -13.24049612 AS lon
      UNION ALL
      SELECT 'Brookfields-Red Pu' AS town, 'West II' AS chiefdom, 'Western Area Urban' AS district, 8.46920615 AS lat, -13.24810229 AS lon
      UNION ALL
      SELECT 'Congo Town' AS town, 'West II' AS chiefdom, 'Western Area Urban' AS district, 8.48136551 AS lat, -13.25534328 AS lon
      UNION ALL
      SELECT 'George Brook (Dwor' AS town, 'West II' AS chiefdom, 'Western Area Urban' AS district, 8.46563761 AS lat, -13.23009879 AS lon
      UNION ALL
      SELECT 'New England-Hannes' AS town, 'West II' AS chiefdom, 'Western Area Urban' AS district, 8.46601573 AS lat, -13.23673575 AS lon
      UNION ALL
      SELECT 'New England-Hill C' AS town, 'West II' AS chiefdom, 'Western Area Urban' AS district, 8.46563494 AS lat, -13.24427435 AS lon
      UNION ALL
      SELECT 'Tengbeh Town' AS town, 'West II' AS chiefdom, 'Western Area Urban' AS district, 8.47146234 AS lat, -13.25402875 AS lon
      UNION ALL
      SELECT 'Aberdeen' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.48129475 AS lat, -13.28312628 AS lon
      UNION ALL
      SELECT 'Cockerill-Aberdeen' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.46615341 AS lat, -13.2741885 AS lon
      UNION ALL
      SELECT 'Cockle-Bay /Colleg' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.48336181 AS lat, -13.27159926 AS lon
      UNION ALL
      SELECT 'Hill Station' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.46004876 AS lat, -13.25527898 AS lon
      UNION ALL
      SELECT 'Juba/Kaningo' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.44672122 AS lat, -13.27077339 AS lon
      UNION ALL
      SELECT 'Lumley' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.46014749 AS lat, -13.266882 AS lon
      UNION ALL
      SELECT 'Malama/Kamayama' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.44865227 AS lat, -13.25307041 AS lon
      UNION ALL
      SELECT 'Murray Town' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.49092854 AS lat, -13.26452547 AS lon
      UNION ALL
      SELECT 'Pipeline/Wilkinson' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.47222262 AS lat, -13.27200745 AS lon
      UNION ALL
      SELECT 'Wilberforce' AS town, 'West III' AS chiefdom, 'Western Area Urban' AS district, 8.47279373 AS lat, -13.26284965 AS lon
      UNION ALL
      SELECT 'Tasso Island' AS town, 'Tasso Island' AS chiefdom, 'Western Area Urban' AS district, 8.55334632 AS lat, -13.0736265 AS lon
      UNION ALL
      SELECT 'Banguraia' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.25118772 AS lat, -12.88526629 AS lon
      UNION ALL
      SELECT 'Bassia' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.27237718 AS lat, -12.8201142 AS lon
      UNION ALL
      SELECT 'Bugami' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.48757083 AS lat, -12.55856438 AS lon
      UNION ALL
      SELECT 'Duramania' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.43529049 AS lat, -12.59914295 AS lon
      UNION ALL
      SELECT 'Filligungee' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.39240671 AS lat, -12.62696608 AS lon
      UNION ALL
      SELECT 'Fortumboyie' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.3727945 AS lat, -12.70025799 AS lon
      UNION ALL
      SELECT 'Gberekhuray' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.46871918 AS lat, -12.58670061 AS lon
      UNION ALL
      SELECT 'Gbolon' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.34018242 AS lat, -12.73505482 AS lon
      UNION ALL
      SELECT 'Kabaya' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.43158468 AS lat, -12.64073641 AS lon
      UNION ALL
      SELECT 'Kanku Bramaia' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.25891333 AS lat, -12.84354836 AS lon
      UNION ALL
      SELECT 'Konta' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.55366058 AS lat, -12.57740014 AS lon
      UNION ALL
      SELECT 'Kua Bramaia' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.32042444 AS lat, -12.76075599 AS lon
      UNION ALL
      SELECT 'Kufuru' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.51227162 AS lat, -12.49918132 AS lon
      UNION ALL
      SELECT 'Kukuna' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.40826197 AS lat, -12.66827289 AS lon
      UNION ALL
      SELECT 'Laminaia' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.23423537 AS lat, -12.86143506 AS lon
      UNION ALL
      SELECT 'Sansangie' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.27095215 AS lat, -12.87367013 AS lon
      UNION ALL
      SELECT 'Seduya' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.43275992 AS lat, -12.66194856 AS lon
      UNION ALL
      SELECT 'Shekaia' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.29140591 AS lat, -12.76424606 AS lon
      UNION ALL
      SELECT 'Sulaimania' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.28800338 AS lat, -12.78136357 AS lon
      UNION ALL
      SELECT 'Teneba Bramaia' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.40627958 AS lat, -12.69088106 AS lon
      UNION ALL
      SELECT 'Turaya' AS town, 'Bramaia' AS chiefdom, 'Kambia' AS district, 9.48058184 AS lat, -12.65199128 AS lon
      UNION ALL
      SELECT 'Gbinle' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.14794688 AS lat, -12.92938723 AS lon
      UNION ALL
      SELECT 'Kalangba' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.18624131 AS lat, -12.92943327 AS lon
      UNION ALL
      SELECT 'Katalan' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.07419189 AS lat, -12.97894084 AS lon
      UNION ALL
      SELECT 'Mafaray' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.21662312 AS lat, -12.92816144 AS lon
      UNION ALL
      SELECT 'Maton' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.26742832 AS lat, -12.9319528 AS lon
      UNION ALL
      SELECT 'Rogberay' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.1453159 AS lat, -12.95530294 AS lon
      UNION ALL
      SELECT 'Sanda' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.07653526 AS lat, -13.0225435 AS lon
      UNION ALL
      SELECT 'Tawuya' AS town, 'Gbinle Dixing' AS chiefdom, 'Kambia' AS district, 9.11987676 AS lat, -12.97324024 AS lon
      UNION ALL
      SELECT 'Bombe' AS town, 'Magbema' AS chiefdom, 'Kambia' AS district, 8.97568356 AS lat, -12.90126699 AS lon
      UNION ALL
      SELECT 'Kamba' AS town, 'Magbema' AS chiefdom, 'Kambia' AS district, 9.04527384 AS lat, -12.87389825 AS lon
      UNION ALL
      SELECT 'Kambia' AS town, 'Magbema' AS chiefdom, 'Kambia' AS district, 9.09867432 AS lat, -12.91648006 AS lon
      UNION ALL
      SELECT 'Kargbulor' AS town, 'Magbema' AS chiefdom, 'Kambia' AS district, 8.94553136 AS lat, -12.9425706 AS lon
      UNION ALL
      SELECT 'Robat' AS town, 'Magbema' AS chiefdom, 'Kambia' AS district, 9.05754351 AS lat, -12.93732707 AS lon
      UNION ALL
      SELECT 'Rokupr' AS town, 'Magbema' AS chiefdom, 'Kambia' AS district, 9.00775609 AS lat, -12.92404189 AS lon
      UNION ALL
      SELECT 'Tormina' AS town, 'Magbema' AS chiefdom, 'Kambia' AS district, 9.1751553 AS lat, -12.88394368 AS lon
      UNION ALL
      SELECT 'Kalenkay' AS town, 'Mambolo' AS chiefdom, 'Kambia' AS district, 8.89618061 AS lat, -13.10779021 AS lon
      UNION ALL
      SELECT 'Mambolo' AS town, 'Mambolo' AS chiefdom, 'Kambia' AS district, 8.90528241 AS lat, -13.02622974 AS lon
      UNION ALL
      SELECT 'Matetie' AS town, 'Mambolo' AS chiefdom, 'Kambia' AS district, 8.90219457 AS lat, -13.05647935 AS lon
      UNION ALL
      SELECT 'Mayakie' AS town, 'Mambolo' AS chiefdom, 'Kambia' AS district, 8.88418878 AS lat, -12.93320942 AS lon
      UNION ALL
      SELECT 'Robis' AS town, 'Mambolo' AS chiefdom, 'Kambia' AS district, 8.88464981 AS lat, -12.98177996 AS lon
      UNION ALL
      SELECT 'Rowollon' AS town, 'Mambolo' AS chiefdom, 'Kambia' AS district, 8.92460116 AS lat, -13.00297333 AS lon
      UNION ALL
      SELECT 'Tombo-Wallah' AS town, 'Mambolo' AS chiefdom, 'Kambia' AS district, 8.86428378 AS lat, -13.0847778 AS lon
      UNION ALL
      SELECT 'Bamoi' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.07811627 AS lat, -12.73326905 AS lon
      UNION ALL
      SELECT 'Benna' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.08101799 AS lat, -12.8184343 AS lon
      UNION ALL
      SELECT 'Kawula' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.1419031 AS lat, -12.84730203 AS lon
      UNION ALL
      SELECT 'Kayenkassa' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.04954539 AS lat, -12.79012165 AS lon
      UNION ALL
      SELECT 'Mapolon' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.14137079 AS lat, -12.72059614 AS lon
      UNION ALL
      SELECT 'Maserie' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.09127992 AS lat, -12.78933424 AS lon
      UNION ALL
      SELECT 'Matengha' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.1156423 AS lat, -12.74591241 AS lon
      UNION ALL
      SELECT 'Matilba' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.14434081 AS lat, -12.74012096 AS lon
      UNION ALL
      SELECT 'Nonko' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.15631836 AS lat, -12.78486726 AS lon
      UNION ALL
      SELECT 'Samu' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.17597569 AS lat, -12.75032155 AS lon
      UNION ALL
      SELECT 'Sumbuya' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.09894241 AS lat, -12.71575862 AS lon
      UNION ALL
      SELECT 'Thalla' AS town, 'Masungbala' AS chiefdom, 'Kambia' AS district, 9.02359276 AS lat, -12.76038639 AS lon
      UNION ALL
      SELECT 'Bubuya' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.03075317 AS lat, -13.05466303 AS lon
      UNION ALL
      SELECT 'Kassiri' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 8.95651548 AS lat, -13.10636249 AS lon
      UNION ALL
      SELECT 'Koya' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 8.9616214 AS lat, -13.03608767 AS lon
      UNION ALL
      SELECT 'Kychom' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 8.96632535 AS lat, -13.1650514 AS lon
      UNION ALL
      SELECT 'Lusenia' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.01494804 AS lat, -13.11360266 AS lon
      UNION ALL
      SELECT 'Mafufuneh' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.000754 AS lat, -13.07526691 AS lon
      UNION ALL
      SELECT 'Makuma' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.00215281 AS lat, -13.27181045 AS lon
      UNION ALL
      SELECT 'Mange' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.0334321 AS lat, -13.00081325 AS lon
      UNION ALL
      SELECT 'Mapotolon' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.04599374 AS lat, -13.2353928 AS lon
      UNION ALL
      SELECT 'Moribaia' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.03969753 AS lat, -13.15498697 AS lon
      UNION ALL
      SELECT 'Rokon' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 9.00405338 AS lat, -12.9935658 AS lon
      UNION ALL
      SELECT 'Rosinor' AS town, 'Samu' AS chiefdom, 'Kambia' AS district, 8.97216813 AS lat, -13.00306623 AS lon
      UNION ALL
      SELECT 'Bubuya' AS town, 'Tonko Limba' AS chiefdom, 'Kambia' AS district, 9.26301514 AS lat, -12.707975 AS lon
      UNION ALL
      SELECT 'Kamassassa' AS town, 'Tonko Limba' AS chiefdom, 'Kambia' AS district, 9.40795634 AS lat, -12.48172063 AS lon
      UNION ALL
      SELECT 'Kathanthineh' AS town, 'Tonko Limba' AS chiefdom, 'Kambia' AS district, 9.28585006 AS lat, -12.55182949 AS lon
      UNION ALL
      SELECT 'Magbonkoh' AS town, 'Tonko Limba' AS chiefdom, 'Kambia' AS district, 9.22704414 AS lat, -12.78005477 AS lon
      UNION ALL
      SELECT 'Mamankoh' AS town, 'Tonko Limba' AS chiefdom, 'Kambia' AS district, 9.17446875 AS lat, -12.68653478 AS lon
      UNION ALL
      SELECT 'Yebaya' AS town, 'Tonko Limba' AS chiefdom, 'Kambia' AS district, 9.33005393 AS lat, -12.59976425 AS lon
      UNION ALL
      SELECT 'Foredugu' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.79057667 AS lat, -12.39661135 AS lon
      UNION ALL
      SELECT 'Gbaran Kamba' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.8336949 AS lat, -12.38542837 AS lon
      UNION ALL
      SELECT 'Kamasundu' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.87489522 AS lat, -12.50389575 AS lon
      UNION ALL
      SELECT 'Mabureh Buya' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.87460785 AS lat, -12.47120476 AS lon
      UNION ALL
      SELECT 'Mabureh Mende' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.79322233 AS lat, -12.53669861 AS lon
      UNION ALL
      SELECT 'Magbengbe' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.82991821 AS lat, -12.43676127 AS lon
      UNION ALL
      SELECT 'Manungbu' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.88590259 AS lat, -12.44286286 AS lon
      UNION ALL
      SELECT 'Petifu Bana' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.72732552 AS lat, -12.53674654 AS lon
      UNION ALL
      SELECT 'Robis' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.75261597 AS lat, -12.45518047 AS lon
      UNION ALL
      SELECT 'Rokel' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.76518723 AS lat, -12.53551142 AS lon
      UNION ALL
      SELECT 'Rosint' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.8274381 AS lat, -12.5087239 AS lon
      UNION ALL
      SELECT 'Worreh Mapoteh' AS town, 'Buya Romende' AS chiefdom, 'Karene' AS district, 8.88257814 AS lat, -12.40093642 AS lon
      UNION ALL
      SELECT 'Karine' AS town, 'Dibia' AS chiefdom, 'Karene' AS district, 8.92677872 AS lat, -12.58506243 AS lon
      UNION ALL
      SELECT 'Kayembor' AS town, 'Dibia' AS chiefdom, 'Karene' AS district, 8.94101288 AS lat, -12.63651078 AS lon
      UNION ALL
      SELECT 'Konta Kargbo' AS town, 'Dibia' AS chiefdom, 'Karene' AS district, 8.89086031 AS lat, -12.62109004 AS lon
      UNION ALL
      SELECT 'Mafonda' AS town, 'Dibia' AS chiefdom, 'Karene' AS district, 8.97993331 AS lat, -12.5939959 AS lon
      UNION ALL
      SELECT 'Makabari' AS town, 'Dibia' AS chiefdom, 'Karene' AS district, 8.91944225 AS lat, -12.64964352 AS lon
      UNION ALL
      SELECT 'Makump' AS town, 'Dibia' AS chiefdom, 'Karene' AS district, 8.8938387 AS lat, -12.68050662 AS lon
      UNION ALL
      SELECT 'Rogbalan' AS town, 'Dibia' AS chiefdom, 'Karene' AS district, 8.9022759 AS lat, -12.57913051 AS lon
      UNION ALL
      SELECT 'Bankro' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.02129434 AS lat, -12.65238656 AS lon
      UNION ALL
      SELECT 'Gbaneh-Loko' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.10589139 AS lat, -12.63094923 AS lon
      UNION ALL
      SELECT 'Gbogbodo' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.19606575 AS lat, -12.58391275 AS lon
      UNION ALL
      SELECT 'Gbonko' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.16873169 AS lat, -12.51996347 AS lon
      UNION ALL
      SELECT 'Kantia' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.22006027 AS lat, -12.46534241 AS lon
      UNION ALL
      SELECT 'Layamantmetank' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.15933166 AS lat, -12.62946603 AS lon
      UNION ALL
      SELECT 'Magbolontor' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.03992115 AS lat, -12.68806646 AS lon
      UNION ALL
      SELECT 'Malkiya' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.08038225 AS lat, -12.68951813 AS lon
      UNION ALL
      SELECT 'Mankneh' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.09487483 AS lat, -12.6812108 AS lon
      UNION ALL
      SELECT 'Masien' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.04244021 AS lat, -12.71895615 AS lon
      UNION ALL
      SELECT 'Menthen' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.11092789 AS lat, -12.5448675 AS lon
      UNION ALL
      SELECT 'Robis' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.14542525 AS lat, -12.47905819 AS lon
      UNION ALL
      SELECT 'Rotigbonko' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.04733746 AS lat, -12.59957749 AS lon
      UNION ALL
      SELECT 'Sendugu' AS town, 'Sanda Magbolont' AS chiefdom, 'Karene' AS district, 9.06924048 AS lat, -12.62344491 AS lon
      UNION ALL
      SELECT 'Gbaray Bana' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.98698513 AS lat, -12.52564333 AS lon
      UNION ALL
      SELECT 'Mafonikay' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.90639905 AS lat, -12.53878091 AS lon
      UNION ALL
      SELECT 'Magbafth' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.89278329 AS lat, -12.5199791 AS lon
      UNION ALL
      SELECT 'Maron' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.94354471 AS lat, -12.5225077 AS lon
      UNION ALL
      SELECT 'Robombeh' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.9214974 AS lat, -12.4797997 AS lon
      UNION ALL
      SELECT 'Batkanu' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 9.07610209 AS lat, -12.42361164 AS lon
      UNION ALL
      SELECT 'Mafonda' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 9.06720308 AS lat, -12.52025449 AS lon
      UNION ALL
      SELECT 'Magbaingba' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.92900183 AS lat, -12.3088654 AS lon
      UNION ALL
      SELECT 'Magbanamba' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 9.03775041 AS lat, -12.45966968 AS lon
      UNION ALL
      SELECT 'Makaiba' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.97464359 AS lat, -12.41618586 AS lon
      UNION ALL
      SELECT 'Makayrembay' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 9.05223522 AS lat, -12.47943606 AS lon
      UNION ALL
      SELECT 'Mandawahun' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.99811001 AS lat, -12.38733336 AS lon
      UNION ALL
      SELECT 'Manyakoi' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.94337399 AS lat, -12.36570855 AS lon
      UNION ALL
      SELECT 'Mayankay' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 9.04141467 AS lat, -12.39602053 AS lon
      UNION ALL
      SELECT 'Robaka' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.9683225 AS lat, -12.47201093 AS lon
      UNION ALL
      SELECT 'Rotha-Tha' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 8.93977032 AS lat, -12.4590484 AS lon
      UNION ALL
      SELECT 'Simbaya' AS town, 'Libeisaygahun' AS chiefdom, 'Karene' AS district, 9.00003482 AS lat, -12.47667344 AS lon
      UNION ALL
      SELECT 'Banka' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.42520653 AS lat, -12.24828072 AS lon
      UNION ALL
      SELECT 'Benia' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.42082245 AS lat, -12.19571239 AS lon
      UNION ALL
      SELECT 'Kaindema' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.39847887 AS lat, -12.29488406 AS lon
      UNION ALL
      SELECT 'Kamalu' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.40188943 AS lat, -12.2421 AS lon
      UNION ALL
      SELECT 'Kania' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.36533876 AS lat, -12.2536681 AS lon
      UNION ALL
      SELECT 'Kindia' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.46652605 AS lat, -12.14579239 AS lon
      UNION ALL
      SELECT 'Laminaya' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.4037492 AS lat, -12.05028382 AS lon
      UNION ALL
      SELECT 'Madina' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.45792866 AS lat, -12.01749502 AS lon
      UNION ALL
      SELECT 'Maharibo' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.38383576 AS lat, -12.13271807 AS lon
      UNION ALL
      SELECT 'Makapa' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.37842778 AS lat, -12.32942007 AS lon
      UNION ALL
      SELECT 'Makwie Loko' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.51788808 AS lat, -12.05714344 AS lon
      UNION ALL
      SELECT 'Manathi' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.3633893 AS lat, -12.1818886 AS lon
      UNION ALL
      SELECT 'Maparay' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.3743517 AS lat, -12.2311123 AS lon
      UNION ALL
      SELECT 'Rothatha' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.42132968 AS lat, -12.29527996 AS lon
      UNION ALL
      SELECT 'Timbo' AS town, 'Sanda Loko' AS chiefdom, 'Karene' AS district, 9.36662147 AS lat, -12.27623894 AS lon
      UNION ALL
      SELECT 'Kalangba' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.21952433 AS lat, -12.26016602 AS lon
      UNION ALL
      SELECT 'Kukuna' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.17479852 AS lat, -12.29018604 AS lon
      UNION ALL
      SELECT 'Marampa' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.18093385 AS lat, -12.35949199 AS lon
      UNION ALL
      SELECT 'Masisan' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.12651438 AS lat, -12.27498072 AS lon
      UNION ALL
      SELECT 'Mateboi' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.10851891 AS lat, -12.35632643 AS lon
      UNION ALL
      SELECT 'Rogbin' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.20860639 AS lat, -12.20340088 AS lon
      UNION ALL
      SELECT 'Rogboreh' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.17855197 AS lat, -12.21766751 AS lon
      UNION ALL
      SELECT 'Rosos' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.14148692 AS lat, -12.41233877 AS lon
      UNION ALL
      SELECT 'Sendugu' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.18032653 AS lat, -12.24995691 AS lon
      UNION ALL
      SELECT 'Yankabala' AS town, 'Sanda Tendaran' AS chiefdom, 'Karene' AS district, 9.17793325 AS lat, -12.32539428 AS lon
      UNION ALL
      SELECT 'Kamakwie' AS town, 'Sella Limba' AS chiefdom, 'Karene' AS district, 9.51041387 AS lat, -12.24405877 AS lon
      UNION ALL
      SELECT 'Kamankoh' AS town, 'Sella Limba' AS chiefdom, 'Karene' AS district, 9.48970604 AS lat, -12.33435488 AS lon
      UNION ALL
      SELECT 'Kayimbor' AS town, 'Sella Limba' AS chiefdom, 'Karene' AS district, 9.5474963 AS lat, -12.12033638 AS lon
      UNION ALL
      SELECT 'Magbonkoni I' AS town, 'Sella Limba' AS chiefdom, 'Karene' AS district, 9.48679607 AS lat, -12.23541666 AS lon
      UNION ALL
      SELECT 'Magbonkoni II' AS town, 'Sella Limba' AS chiefdom, 'Karene' AS district, 9.44474642 AS lat, -12.3328861 AS lon
      UNION ALL
      SELECT 'Manonkoh' AS town, 'Sella Limba' AS chiefdom, 'Karene' AS district, 9.45355675 AS lat, -12.26829061 AS lon
      UNION ALL
      SELECT 'Samia' AS town, 'Sella Limba' AS chiefdom, 'Karene' AS district, 9.56081367 AS lat, -12.24143759 AS lon
      UNION ALL
      SELECT 'Dugutha' AS town, 'Tambakha' AS chiefdom, 'Karene' AS district, 9.75261708 AS lat, -12.01926851 AS lon
      UNION ALL
      SELECT 'Moria' AS town, 'Tambakha' AS chiefdom, 'Karene' AS district, 9.85713368 AS lat, -12.22099259 AS lon
      UNION ALL
      SELECT 'Paramount Chief Se' AS town, 'Tambakha' AS chiefdom, 'Karene' AS district, 9.72319772 AS lat, -12.29665028 AS lon
      UNION ALL
      SELECT 'Simibue' AS town, 'Tambakha' AS chiefdom, 'Karene' AS district, 9.60530163 AS lat, -12.44188178 AS lon
      UNION ALL
      SELECT 'Thalla' AS town, 'Tambakha' AS chiefdom, 'Karene' AS district, 9.82402304 AS lat, -12.39188752 AS lon
      UNION ALL
      SELECT 'Barmoi' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.98784417 AS lat, -12.63672261 AS lon
      UNION ALL
      SELECT 'Kagbanthama' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.95121345 AS lat, -12.67584701 AS lon
      UNION ALL
      SELECT 'Kaiyeabor' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.92945732 AS lat, -12.81478449 AS lon
      UNION ALL
      SELECT 'Kalangba' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.89012964 AS lat, -12.88890446 AS lon
      UNION ALL
      SELECT 'Kambia Morie' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.93892285 AS lat, -12.85194587 AS lon
      UNION ALL
      SELECT 'Konta Ferry' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.91609464 AS lat, -12.84555094 AS lon
      UNION ALL
      SELECT 'Mabombo' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.97310759 AS lat, -12.77647148 AS lon
      UNION ALL
      SELECT 'Makana' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.87460215 AS lat, -12.80292817 AS lon
      UNION ALL
      SELECT 'Mamanka' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.86652277 AS lat, -12.83378342 AS lon
      UNION ALL
      SELECT 'Mange Morie' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.93232623 AS lat, -12.8734966 AS lon
      UNION ALL
      SELECT 'Marenka' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.98927062 AS lat, -12.69799286 AS lon
      UNION ALL
      SELECT 'Minthormore' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.9958658 AS lat, -12.82411055 AS lon
      UNION ALL
      SELECT 'Rogbla' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.85677192 AS lat, -12.86615784 AS lon
      UNION ALL
      SELECT 'Romeni' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.91065373 AS lat, -12.72111128 AS lon
      UNION ALL
      SELECT 'Rotifunk' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.93579445 AS lat, -12.76505497 AS lon
      UNION ALL
      SELECT 'Yali-Sanda' AS town, 'Bureh Kasseh Ma' AS chiefdom, 'Port Loko' AS district, 8.89042814 AS lat, -12.83275362 AS lon
      UNION ALL
      SELECT 'Foronkoya' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.64023481 AS lat, -13.18694453 AS lon
      UNION ALL
      SELECT 'Kasongha' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.61782025 AS lat, -13.16080867 AS lon
      UNION ALL
      SELECT 'Lungi' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.67671201 AS lat, -13.19748734 AS lon
      UNION ALL
      SELECT 'Mahera' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.60924744 AS lat, -13.18795521 AS lon
      UNION ALL
      SELECT 'Mamanki' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.57467568 AS lat, -13.15132935 AS lon
      UNION ALL
      SELECT 'Mayaya' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.6776289 AS lat, -13.23070555 AS lon
      UNION ALL
      SELECT 'Rosint' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.5435117 AS lat, -13.16320193 AS lon
      UNION ALL
      SELECT 'Yongro' AS town, 'Kaffu Bullom' AS chiefdom, 'Port Loko' AS district, 8.5800124 AS lat, -13.18838062 AS lon
      UNION ALL
      SELECT 'Benkia' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.52556796 AS lat, -12.94901811 AS lon
      UNION ALL
      SELECT 'Fondu' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.45495553 AS lat, -12.77741992 AS lon
      UNION ALL
      SELECT 'Foredugu' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.45126749 AS lat, -12.83033301 AS lon
      UNION ALL
      SELECT 'Futa' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.49282605 AS lat, -12.93646099 AS lon
      UNION ALL
      SELECT 'Gbabai' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.42495984 AS lat, -12.88882923 AS lon
      UNION ALL
      SELECT 'Kagbala A' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.32146467 AS lat, -12.89483751 AS lon
      UNION ALL
      SELECT 'Kagbala B' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.38552133 AS lat, -12.99381185 AS lon
      UNION ALL
      SELECT 'Magbandoma' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.4197712 AS lat, -12.85997051 AS lon
      UNION ALL
      SELECT 'Magbeni' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.50304845 AS lat, -12.85084438 AS lon
      UNION ALL
      SELECT 'Mahera' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.54198246 AS lat, -12.76853826 AS lon
      UNION ALL
      SELECT 'Marefa' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.47258403 AS lat, -13.06474763 AS lon
      UNION ALL
      SELECT 'Matene' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.47935875 AS lat, -12.65543621 AS lon
      UNION ALL
      SELECT 'Mathirie' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.40012443 AS lat, -12.91352384 AS lon
      UNION ALL
      SELECT 'Mawoma' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.44071941 AS lat, -12.70444465 AS lon
      UNION ALL
      SELECT 'Robia' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.40123245 AS lat, -13.04713089 AS lon
      UNION ALL
      SELECT 'Rokel' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.55014683 AS lat, -12.71157357 AS lon
      UNION ALL
      SELECT 'Roponka' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.52564921 AS lat, -12.88893072 AS lon
      UNION ALL
      SELECT 'Rosarr' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.5575062 AS lat, -12.73967294 AS lon
      UNION ALL
      SELECT 'Sanda' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.40948786 AS lat, -12.96863773 AS lon
      UNION ALL
      SELECT 'Tumba' AS town, 'Koya' AS chiefdom, 'Port Loko' AS district, 8.5059709 AS lat, -13.009614 AS lon
      UNION ALL
      SELECT 'Benkia' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.75942591 AS lat, -13.01239035 AS lon
      UNION ALL
      SELECT 'Gbainty' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.79875434 AS lat, -13.09407183 AS lon
      UNION ALL
      SELECT 'Kamasondo' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.6365917 AS lat, -12.95165062 AS lon
      UNION ALL
      SELECT 'Kantaya' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.70218027 AS lat, -13.02956007 AS lon
      UNION ALL
      SELECT 'Katonga' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.78705579 AS lat, -12.95990003 AS lon
      UNION ALL
      SELECT 'Komrabai' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.67674524 AS lat, -13.1426876 AS lon
      UNION ALL
      SELECT 'Konta' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.82332063 AS lat, -13.02106836 AS lon
      UNION ALL
      SELECT 'Magbokorr' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.74445901 AS lat, -12.91108477 AS lon
      UNION ALL
      SELECT 'Mannah' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.71373331 AS lat, -12.94594843 AS lon
      UNION ALL
      SELECT 'Mapiterr' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.65718645 AS lat, -13.07691043 AS lon
      UNION ALL
      SELECT 'Matheng' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.71969118 AS lat, -13.16381074 AS lon
      UNION ALL
      SELECT 'Petifu' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.68672132 AS lat, -13.06372294 AS lon
      UNION ALL
      SELECT 'Royema' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.73334237 AS lat, -13.0834285 AS lon
      UNION ALL
      SELECT 'Yurika' AS town, 'Lokomasama' AS chiefdom, 'Port Loko' AS district, 8.77950865 AS lat, -13.19777753 AS lon
      UNION ALL
      SELECT 'Batpolon' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.7169234 AS lat, -12.69533925 AS lon
      UNION ALL
      SELECT 'Falaba' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.77091833 AS lat, -12.77974747 AS lon
      UNION ALL
      SELECT 'Fenka' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.75585059 AS lat, -12.70001042 AS lon
      UNION ALL
      SELECT 'Gberray Bana' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.58775667 AS lat, -12.78864722 AS lon
      UNION ALL
      SELECT 'Gberray Morie' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.78571224 AS lat, -12.87601973 AS lon
      UNION ALL
      SELECT 'Gberray Thunkara' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.7071538 AS lat, -12.84686001 AS lon
      UNION ALL
      SELECT 'Gbonko Mayira' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.64485339 AS lat, -12.86441758 AS lon
      UNION ALL
      SELECT 'Kabata' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.83349825 AS lat, -12.71303985 AS lon
      UNION ALL
      SELECT 'Komrabai-Waterloo' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.71449073 AS lat, -12.62520725 AS lon
      UNION ALL
      SELECT 'Kondato' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.76031204 AS lat, -12.78169366 AS lon
      UNION ALL
      SELECT 'Maboni' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.63801487 AS lat, -12.89055596 AS lon
      UNION ALL
      SELECT 'Maforay' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.7010833 AS lat, -12.80139538 AS lon
      UNION ALL
      SELECT 'Magbankitha' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.74295909 AS lat, -12.59609591 AS lon
      UNION ALL
      SELECT 'Magbengbeh' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.67491852 AS lat, -12.82400663 AS lon
      UNION ALL
      SELECT 'Magbeni' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.80407668 AS lat, -12.79708038 AS lon
      UNION ALL
      SELECT 'Makorobolai' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.58591225 AS lat, -12.90565398 AS lon
      UNION ALL
      SELECT 'Malal' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.85530985 AS lat, -12.75424148 AS lon
      UNION ALL
      SELECT 'Mamanso' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.74772488 AS lat, -12.63728907 AS lon
      UNION ALL
      SELECT 'Mapolie' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.62863786 AS lat, -12.79155636 AS lon
      UNION ALL
      SELECT 'Maronko' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.73133035 AS lat, -12.57449598 AS lon
      UNION ALL
      SELECT 'Marunia' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.6433095 AS lat, -12.82492648 AS lon
      UNION ALL
      SELECT 'Massebay' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.58277296 AS lat, -12.83724746 AS lon
      UNION ALL
      SELECT 'Mathera' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.67932066 AS lat, -12.76601562 AS lon
      UNION ALL
      SELECT 'Moria' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.72545049 AS lat, -12.74663708 AS lon
      UNION ALL
      SELECT 'Old Port Loko' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.75140109 AS lat, -12.7855134 AS lon
      UNION ALL
      SELECT 'Romaka' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.78325942 AS lat, -12.74510168 AS lon
      UNION ALL
      SELECT 'Rosarr' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.7330986 AS lat, -12.79584008 AS lon
      UNION ALL
      SELECT 'Sanda' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.76169497 AS lat, -12.79059082 AS lon
      UNION ALL
      SELECT 'Sendugu' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.77443474 AS lat, -12.7901714 AS lon
      UNION ALL
      SELECT 'Tauya' AS town, 'Maforki' AS chiefdom, 'Port Loko' AS district, 8.82504102 AS lat, -12.81326662 AS lon
      UNION ALL
      SELECT 'Lunsar-Baipolon' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.68348209 AS lat, -12.53560046 AS lon
      UNION ALL
      SELECT 'Lunsar-Four Road -' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.6795184 AS lat, -12.54158525 AS lon
      UNION ALL
      SELECT 'Lunsar-Kenneday' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.68335491 AS lat, -12.53120916 AS lon
      UNION ALL
      SELECT 'Lunsar-Mabai' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.67449672 AS lat, -12.53477909 AS lon
      UNION ALL
      SELECT 'Lunsar-Madigbo' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.69735684 AS lat, -12.53187304 AS lon
      UNION ALL
      SELECT 'Lunsar-Mamanso' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.68134512 AS lat, -12.53034642 AS lon
      UNION ALL
      SELECT 'Lunsar-Mines' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.67510554 AS lat, -12.51453346 AS lon
      UNION ALL
      SELECT 'Lunsar-Old Town' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.66826732 AS lat, -12.53764984 AS lon
      UNION ALL
      SELECT 'Lunsar-Path Bana' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.68731588 AS lat, -12.52526032 AS lon
      UNION ALL
      SELECT 'Lunsar-Robis' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.67165374 AS lat, -12.52515791 AS lon
      UNION ALL
      SELECT 'Lunsar-Technical' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.69387565 AS lat, -12.54185361 AS lon
      UNION ALL
      SELECT 'Magbele' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.63518379 AS lat, -12.66761042 AS lon
      UNION ALL
      SELECT 'Mange' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.70895029 AS lat, -12.38887807 AS lon
      UNION ALL
      SELECT 'Marampa' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.70246888 AS lat, -12.48535685 AS lon
      UNION ALL
      SELECT 'Mawullay' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.65414329 AS lat, -12.51509383 AS lon
      UNION ALL
      SELECT 'Petifu Madina' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.63943444 AS lat, -12.72591709 AS lon
      UNION ALL
      SELECT 'Rogballan' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.68103765 AS lat, -12.58421518 AS lon
      UNION ALL
      SELECT 'Rolankonoh' AS town, 'Marampa' AS chiefdom, 'Port Loko' AS district, 8.66476138 AS lat, -12.63118341 AS lon
      UNION ALL
      SELECT 'Biki' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.4815266 AS lat, -12.5309707 AS lon
      UNION ALL
      SELECT 'Biss-Manika' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.53239355 AS lat, -12.5121107 AS lon
      UNION ALL
      SELECT 'Katick' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.54957943 AS lat, -12.40014194 AS lon
      UNION ALL
      SELECT 'Maconteh' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.56538394 AS lat, -12.47607461 AS lon
      UNION ALL
      SELECT 'Mamalikie' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.4886262 AS lat, -12.56918038 AS lon
      UNION ALL
      SELECT 'Masimera' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.63225854 AS lat, -12.43923533 AS lon
      UNION ALL
      SELECT 'Matuku' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.55185463 AS lat, -12.43742543 AS lon
      UNION ALL
      SELECT 'Mayola-Thatha' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.60260358 AS lat, -12.36854392 AS lon
      UNION ALL
      SELECT 'Nonkoba' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.61958243 AS lat, -12.57916687 AS lon
      UNION ALL
      SELECT 'Rokel' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.56546519 AS lat, -12.67767003 AS lon
      UNION ALL
      SELECT 'Rokon/Komboya' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.57879136 AS lat, -12.61296882 AS lon
      UNION ALL
      SELECT 'Yoni-Pet' AS town, 'Masimera' AS chiefdom, 'Port Loko' AS district, 8.58699833 AS lat, -12.53915235 AS lon
      UNION ALL
      SELECT 'Kambia' AS town, 'TMS' AS chiefdom, 'Port Loko' AS district, 8.81868643 AS lat, -12.57359798 AS lon
      UNION ALL
      SELECT 'Kanu' AS town, 'TMS' AS chiefdom, 'Port Loko' AS district, 8.86297603 AS lat, -12.57151872 AS lon
      UNION ALL
      SELECT 'Kargbo' AS town, 'TMS' AS chiefdom, 'Port Loko' AS district, 8.86432883 AS lat, -12.65714869 AS lon
      UNION ALL
      SELECT 'Konkorie' AS town, 'TMS' AS chiefdom, 'Port Loko' AS district, 8.83434496 AS lat, -12.64474775 AS lon
      UNION ALL
      SELECT 'Magbapsa' AS town, 'TMS' AS chiefdom, 'Port Loko' AS district, 8.78014203 AS lat, -12.60179836 AS lon
      UNION ALL
      SELECT 'Malakuray' AS town, 'TMS' AS chiefdom, 'Port Loko' AS district, 8.7968448 AS lat, -12.6374749 AS lon
      UNION ALL
      SELECT 'Kambaia' AS town, 'Sulima' AS chiefdom, 'Fabala' AS district, 9.78300173 AS lat, -11.04621807 AS lon
    ) t
    JOIN msip_municipio m
      ON m.nombre = t.chiefdom
    JOIN msip_departamento d
      ON d.id = m.departamento_id AND d.nombre = t.district AND d.pais_id = 694
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_centropoblado cp
      WHERE cp.nombre = t.town AND cp.municipio_id = m.id
    )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DELETE FROM msip_centropoblado
    WHERE municipio_id IN (
      SELECT id FROM msip_municipio
      WHERE departamento_id IN (SELECT id FROM msip_departamento WHERE pais_id = 694)
    )
  `.execute(db)
}
