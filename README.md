# ReseptiApp

Yksinkertainen henkilökohtainen reseptisovellus. Sovellus käyttää Reactia ja Viteä, eikä vaadi kirjautumista tai maksullisia palveluita.

## Asennus

1. Asenna Node.js, jos sitä ei ole vielä asennettu. Node.js sisältää npm-työkalun.
2. Avaa komentorivi projektikansiossa:

```bash
cd resepti-app
```

3. Asenna riippuvuudet:

```bash
npm install
```

## Ajaminen paikallisesti

Käynnistä kehitysversio:

```bash
npm run dev
```

Avaa selaimessa osoite, jonka Vite näyttää komentorivillä. Yleensä se on:

```text
http://localhost:5173
```

## Kaytto puhelimessa appina

Sovellus on tehty asennettavaksi verkkosovellukseksi eli PWA-sovellukseksi. Kun sovellus on avattu puhelimen selaimessa HTTPS-osoitteesta, sen voi lisata puhelimen aloitusnaytolle.

Helpoin maksuton jatkovaihe on julkaista valmis `dist`-kansio esimerkiksi GitHub Pagesiin, Cloudflare Pagesiin tai Netlifyyn. Ne antavat sovellukselle HTTPS-osoitteen, jota puhelin tarvitsee asennusta ja offline-kayttoa varten.

Androidissa avaa sovelluksen osoite Chromella ja valitse selaimen valikosta `Asenna sovellus` tai `Lisaa aloitusnaytolle`.

iPhonessa avaa sovelluksen osoite Safarilla, paina jakopainiketta ja valitse `Lisaa Koti-valikkoon`.

Huomaa, etta reseptit tallentuvat sen laitteen selaimeen, jolla sovellusta kaytetaan. Puhelimen reseptit ovat siis puhelimessa. Siirra reseptit laitteelta toiselle varmuuskopion viennilla ja tuonnilla.

## Julkaisu GitHub Pagesiin

Tama projekti on valmiiksi asetettu GitHub Pages -julkaisua varten. Luo GitHubiin uusi repository nimella:

```text
resepti-app
```

Repositoryn nimen kannattaa olla juuri `resepti-app`, koska `vite.config.js` kayttaa osoitepolkua `/resepti-app/`.

Helpoin tapa vieda projekti GitHubiin on GitHub Desktop:

1. Asenna GitHub Desktop.
2. Valitse `File` -> `Add local repository`.
3. Valitse kansio `resepti-app`.
4. Tee ensimmainen commit.
5. Paina `Publish repository`.
6. Valitse nimeksi `resepti-app`.
7. Julkaise repository mieluiten public-muodossa, jotta GitHub Pages toimii ilmaiseksi.

GitHubissa avaa repositoryn asetukset:

1. Mene `Settings`.
2. Mene `Pages`.
3. Valitse Source-kohdasta `GitHub Actions`.

Kun tiedostot on viety GitHubiin, GitHub rakentaa sovelluksen automaattisesti. Julkaistu osoite on taman muotoinen:

```text
https://OMA-GITHUB-NIMI.github.io/resepti-app/
```

Androidissa avaa osoite Chromella ja valitse `Asenna sovellus` tai `Lisaa aloitusnaytolle`.

iPhonessa avaa osoite Safarilla, paina jakopainiketta ja valitse `Lisaa Koti-valikkoon`.

Tarkeaa: localhostissa tallennetut reseptit eivat automaattisesti siirry GitHub Pages -osoitteeseen. Vie ensin varmuuskopio localhost-versiosta ja tuo se sitten GitHub Pages -versiossa.

## Build

Tee tuotantoversio:

```bash
npm run build
```

Valmiit tiedostot tulevat `dist`-kansioon. Voit tarkistaa buildin paikallisesti komennolla:

```bash
npm run preview
```

## Turvallinen päivittäminen

Ennen isoja muutoksia kopioi tai pakkaa koko projektikansio talteen. Esimerkkitiedostonimi:

```text
ReseptiApp_v1_toimiva.zip
```

Älä poista selaimen localStorage-tietoja päivityksen yhteydessä. Älä myöskään muuta reseptin tietorakennetta ilman hyvää syytä, jotta myöhempi Supabase-siirto pysyy helppona.

## Missä reseptit tallennetaan

Reseptejä ei tallenneta lähdekoodiin. Ne tallennetaan selaimen localStorageen avaimella:

```text
reseptiapp.recipes.v1
```

Tämä tarkoittaa, että reseptit ovat kyseisessä selaimessa ja kyseisellä laitteella. Jos vaihdat selainta, tyhjennät selaimen sivustotiedot tai käytät toista konetta, reseptit eivät automaattisesti seuraa mukana.

## Varmuuskopion vienti ja tuonti

Sovelluksessa on `Vie varmuuskopio` -painike. Se lataa kaikki reseptit JSON-tiedostona omalle koneelle.

Sovelluksessa on myös `Tuo varmuuskopio` -painike. Sillä voit tuoda aiemmin tallennetun JSON-varmuuskopion takaisin sovellukseen.

Tuonti ei korvaa olemassa olevia reseptejä ilman varoitusta. Jos tuontitiedostossa on samalla tunnuksella olevia reseptejä, sovellus kysyy ennen korvaamista.

Muista ottaa varmuuskopio säännöllisesti.

## Reseptin tietorakenne

Sovellus käyttää samaa rakennetta jokaiselle reseptille, jotta Supabase voidaan lisätä myöhemmin helpommin:

```json
{
  "id": "string",
  "title": "string",
  "category": "string",
  "tags": [],
  "ingredients": "string",
  "instructions": "string",
  "notes": "string",
  "servings": "string",
  "prepTime": "string",
  "cookTime": "string",
  "sourceUrl": "string",
  "image": "string",
  "favorite": false,
  "createdAt": "string",
  "updatedAt": "string"
}
```

Kuva tallennetaan reseptin mukana pienennettynä data-osoitteena. Sovellus pienentää kuvan ennen tallennusta ja käyttää enintään 1200 pikselin leveyttä.
