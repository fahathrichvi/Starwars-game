/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Campaign missions, objectives, enemy waves and radio chatter */
(function () {
  SW.MISSIONS = [
    {
      title: 'OPERATION FIRST LIGHT',
      sub: 'Mission 1 — Kessra Outer Belt',
      briefing: 'An Imperial TIE patrol is sweeping the Kessra asteroid belt, hunting our supply convoys. Red Squadron will drop out of hyperspace on their flank. Engage and destroy every fighter before they can report our position to the fleet.',
      objectives: [{ type: 'kills', count: 10, text: 'Destroy 10 TIE Fighters' }],
      wingmen: ['RED TWO', 'RED THREE'],
      waves: [
        { spawn: [['tie', 5]] },
        { spawn: [['tie', 5]], when: 2 },
      ],
      intro: [
        ['RED LEADER', 'Red Squadron, lock S-foils in attack position. Here they come!'],
        ['RED TWO', 'I see them — five TIEs, dead ahead.'],
      ],
      torps: 6,
    },
    {
      title: 'OPERATION IRON VEIL',
      sub: 'Mission 2 — The Interceptor Screen',
      briefing: 'Our scouts report the Empire is escorting a fleet tender with TIE Interceptors — faster, deadlier and better armed than standard TIEs. Break their screen. Watch your shields and lead your shots; these pilots are the best the Empire has.',
      objectives: [{ type: 'kills', count: 16, text: 'Destroy 16 Imperial fighters' }],
      wingmen: ['RED TWO', 'RED THREE', 'RED FOUR'],
      waves: [
        { spawn: [['tie', 4], ['interceptor', 2]] },
        { spawn: [['interceptor', 3], ['tie', 2]], when: 2 },
        { spawn: [['interceptor', 3], ['tie', 2]], when: 2 },
      ],
      intro: [
        ['RED LEADER', 'Interceptors inbound. Stay sharp, Red Squadron.'],
        ['RED FOUR', "They're fast... I can barely track them!"],
      ],
      torps: 6,
    },
    {
      title: 'OPERATION SHATTERED CROWN',
      sub: 'Mission 3 — Assault on the Dominion',
      briefing: 'The Imperial Star Destroyer DOMINION is jumping into the Kessra system to crush our fleet. Its turbolasers will tear apart any capital ship we send — but a fighter strike can cripple it. Destroy the two SHIELD GENERATOR domes atop the command tower, then take out the BRIDGE. Use proton torpedoes on the key targets. May the Force be with you.',
      objectives: [
        { type: 'shields', text: 'Destroy both shield generators' },
        { type: 'bridge', text: 'Destroy the command bridge' },
      ],
      wingmen: ['RED TWO', 'RED THREE', 'RED FOUR', 'GOLD FIVE'],
      waves: [{ spawn: [['tie', 4]] }],
      capital: true,
      intro: [
        ['REBEL COMMAND', 'Red Squadron, sensors show a massive ship dropping out of hyperspace!', 'command'],
      ],
      torps: 10,
    },
    {
      title: 'ENDLESS: LAST STAND',
      sub: 'Survival — How long can you hold the line?',
      briefing: 'The Empire has committed everything it has left. Wave after wave of TIE fighters and Interceptors are inbound. There is no retreat. Survive as long as you can and rack up the highest score in the galaxy.',
      objectives: [{ type: 'survive', text: 'Survive the endless Imperial assault' }],
      wingmen: ['RED TWO', 'RED THREE'],
      waves: [],
      endless: true,
      intro: [['RED LEADER', "This is it, everyone. They're coming in waves. Hold the line!"]],
      torps: 8,
    },
  ];

  SW.CHATTER = {
    rebelKill: [
      'Got one!', 'Splash one TIE!', "He's gone!", 'Great shot!', "That's another one down!", 'Scratch one!',
      'Yahoo! Nice flying!', 'Direct hit!',
    ],
    playerKill: [
      "Great shot, Leader! That's one in a million!", 'Nice shooting, Red Leader!', 'Good kill, Leader!',
      'You got him!', "He didn't stand a chance!", 'Great flying, Leader!',
    ],
    wingHurt: [
      "I'm hit! I'm hit! Shields holding...", "Get him off me! I can't shake him!", 'Taking fire! Somebody help!',
      "I've got one on my tail!", 'Losing power to my rear deflector!',
    ],
    wingLost: ["I can't hold it! Ahhh—", 'Eject! Eject— *static*', "I'm going down!"],
    playerHurt: ["Leader, you've got one on your tail!", 'Watch yourself, Leader!', "Red Leader, you're taking fire!"],
    empire: [
      'All TIE units, converge on the lead X-wing.', 'Rebel scum. Cut them down.', 'Close formation. Do not let them escape.',
      'Target their astromech units.',
    ],
    lowHull: ['*frantic beeping* Hull integrity critical!', '*worried whistle* Hull is failing, pull back!'],
  };
})();
