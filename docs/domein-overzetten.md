# cardsofcronos.com van Firebase naar de Worker

Opgeschreven op 2026-08-23, toen het domein nog bij Firebase stond en de nieuwe
site alleen op `cards-of-cronos.steph-danser.workers.dev` te bereiken was.

De reden dat dit een document is en geen commando: een Cloudflare Worker kan een
eigen domein alleen bedienen als de zone bij Cloudflare staat. Een CNAME vanaf
Hostnet naar `workers.dev` werkt niet — dat adres accepteert geen vreemde
hostnames. Er moet dus een nameserverwissel komen, en die kan alleen de eigenaar
van het domein doen.

## Hoe het er nu uitziet

Nameservers: `ns01.hostnet.nl`, `ns02.hostnet.nl`

| Naam | Type | Waarde |
|---|---|---|
| `cardsofcronos.com` | A | `199.36.158.100` (Firebase Hosting) |
| `www` | CNAME | `cardsofcronos.com` |
| `*` | A | `199.36.158.100` — wildcard |
| `cardsofcronos.com` | TXT | `v=spf1 a mx include:_spf.hostnet.nl -all` |
| `cardsofcronos.com` | TXT | `hosting-site=my-project-1472564361903` |

Geen MX. Er komt dus geen mail binnen op dit domein en de verhuizing kan geen
mail breken. De SPF-regel staat er wel, en die moet mee: hij zegt dat niemand
namens dit domein mag versturen (`-all`), en dat is een regel die je niet
per ongeluk laat vallen.

De wildcard is de reden dat `mail`, `webmail`, `ftp`, `admin` en elke andere naam
die je verzint een antwoord geven. Er is geen manier om van buitenaf te zien
welke subdomeinen echt in gebruik zijn — als er iets draait dat hier niet in de
tabel staat, weet alleen het Hostnet-paneel dat.

## De volgorde

Die is niet vrijblijvend. Stap 5 mag pas als stap 4 klopt, anders is het domein
stuk tot de rest af is.

1. **Zone aanmaken.** In het Cloudflare-dashboard `cardsofcronos.com` toevoegen
   aan account `407d41c8869a66cfd6656455baca6430`. Kies de gratis tier.
   Cloudflare scant de bestaande DNS en neemt over wat het kan vinden — dat is
   in dit geval bijna alles, maar loop de tabel hierboven na. De wildcard komt
   er meestal niet in.

2. **Records controleren vóór de wissel.** Beide TXT-regels moeten er staan.
   De A-records mogen op Firebase blijven wijzen: zolang de nameservers nog niet
   om zijn, doet Cloudflare niets, en zodra ze om zijn blijft de oude site
   gewoon werken. Dat is precies de bedoeling — eerst verhuizen, dan pas
   omschakelen.

3. **Nameservers wisselen bij Hostnet.** Cloudflare geeft er twee. Die zet je in
   het Hostnet-paneel in plaats van `ns01`/`ns02.hostnet.nl`. Doorwerken duurt
   meestal een paar uur, soms een dag. Te volgen met:

       dig +short NS cardsofcronos.com

   Zolang daar `hostnet.nl` staat, is er nog niets veranderd.

4. **Domein aan de Worker koppelen.** Zodra de zone actief is, het blok in
   `wrangler.jsonc` erbij zetten (het staat daar in commentaar klaar) en
   deployen. Wrangler maakt de DNS-records zelf aan en vervangt daarmee de
   A-records naar Firebase. Certificaat regelt Cloudflare.

       npm run deploy

   Daarna controleren dat het echt de nieuwe site is, niet een cache:

       curl -sI https://cardsofcronos.com | head -1
       curl -s https://cardsofcronos.com | grep -o '<title>[^<]*'

5. **Pas hierna de oude opruimen.** In de Firebase-console het custom domain van
   Hosting halen, en de drie overgebleven functies weg: `ssrmyproject14725643619`
   (de oude site), `on_lobby_ready` en `start_battle_python`. De vierde,
   `claimWeeklyTokens`, is al verwijderd.

   De bestellingen staan op dat moment al in `orders/` op de computer van de
   eigenaar: 67 aanvragen, 37 afgeronde met alle 37 illustraties, plus de
   claims, wedstrijden en lobbies. Wat daar niet in zit zijn de gesprekken bij
   elf van die bestellingen — bewust overgeslagen, de bestellingen zelf dragen
   alles wat nodig is om er kaarten van te maken.

## Terug kunnen

Tot stap 4 kost terugdraaien niets: nameservers terugzetten bij Hostnet en het
is weer zoals het was. Na stap 5 niet meer — de Firebase-functies zijn dan weg
en de oude site is niet meer te serveren. Doe stap 5 daarom niet dezelfde dag
als stap 4.
