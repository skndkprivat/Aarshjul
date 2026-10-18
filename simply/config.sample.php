<?php
// Kopiér denne fil til config.php på serveren og ret værdierne.
// config.php må ikke committes eller deles.
return [
    // Hemmelig kode til setup.php (engangsopsætning). Vælg en lang, tilfældig tekst.
    'setup_token' => 'SKIFT-MIG',

    // Mappe til data (aktiviteter, brugere, historik). Placér den helst UDEN FOR den
    // offentlige webmappe. Ellers beskytter .htaccess i mappen mod direkte adgang.
    'data_dir' => __DIR__ . '/data',

    // Minutter uden aktivitet, før en admin logges ud.
    'session_minutes' => 30,
];
