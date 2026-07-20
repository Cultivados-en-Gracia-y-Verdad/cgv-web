---
title: "Radio CGV"
---

## Enseñanza bíblica diaria

Radio CGV transmite enseñanza bíblica diaria como una extensión sencilla del deseo de servir a la iglesia local.

No pretende ocupar el centro del sitio, sino ofrecer un medio adicional para escuchar enseñanza bíblica y acompañar la formación continua de creyentes.

## Escuchar Radio CGV

<div class="radio-player">
  <iframe src="https://player.radioking.io/cgv/?c=%230DB050&c2=%23FFFFFF&f=h&i=0&p=1&s=1&alb=NaN&li=1&popup=1&plc=0&h=100&l=100&v=2&fullsize" style="border-radius: 5px; width: 100%; max-width: 430px; height: 145px; -webkit-box-shadow: 0px 0px 20px 0px rgba(0,0,0,0.3);-moz-box-shadow: 0px 0px 20px 0px rgba(0,0,0,0.3);box-shadow: 0px 0px 20px 0px rgba(0,0,0,0.3);" frameborder="0"></iframe>
</div>

<script type="text/javascript" src="https://player.radioking.io/scripts/iframe.bundle.js"></script>

También puede escuchar Radio CGV aquí: [welove.radio/radio/cgv](https://welove.radio/radio/cgv/).

## Comentarios y chat en vivo

Los comentarios sobre lo que está sonando y el chat en vivo con otros oyentes suceden en nuestro canal de Telegram: cada canción nueva abre su propio hilo de conversación.

<p><a href="https://t.me/cgvradio" target="_blank" rel="noopener">Unirse al canal de Telegram de Radio CGV →</a></p>

<div id="cgv-radio-chat"></div>

<script>
(function () {
  var container = document.getElementById("cgv-radio-chat");
  var channel = "cgvradio"; // TODO: replace with the real channel @username once created
  fetch("https://raw.githubusercontent.com/Cultivados-en-Gracia-y-Verdad/cgv-web/main/radio-bot/state.json", { cache: "no-store" })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (state) {
      if (!state || !state.messageId) return;
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-post", channel + "/" + state.messageId);
      script.setAttribute("data-width", "100%");
      container.appendChild(script);
    })
    .catch(function () {
      // Fallback link above still works if this fails.
    });
})();
</script>

## Relación con CGV

La radio acompaña el mismo propósito general de CGV: fomentar formación bíblica seria, discipulado intencional y atención cuidadosa a la Palabra de Dios dentro de la vida de la iglesia local.
