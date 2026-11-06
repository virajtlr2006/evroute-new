// Charging guides. To change a video, replace its `videoId` (the part after ?v= in a YouTube link).
// Videos are third-party YouTube walkthroughs, not hosted by EVRoute. They are general demonstrations: station
// screens, apps and prices differ by operator, so always follow the instructions printed on the charger itself.

export interface GuideStep { title: string; detail: string }
export interface Guide {
  key: string;
  name: string;
  short: string;
  usedFor: string;
  speed: string;
  videoId: string;
  videoTitle: string;
  videoNote?: string;
  steps: GuideStep[];
  tips: string[];
  chargerFilter: { type?: string; connector?: string };
}

export const GUIDE_KEY_BY_CONNECTOR: Record<string, string> = {
  CCS2: 'ccs2', CHAdeMO: 'chademo', Type2: 'type2', 'GB/T': 'gbt', '15A socket': 'socket15', 'Battery swap': 'swap',
};

export const BEFORE_YOU_GO: GuideStep[] = [
  { title: 'Check it is working', detail: 'Open the charger page on EVRoute and read the latest driver report. Reports older than 24 hours show as "no recent report", so treat those with care.' },
  { title: 'Match the connector', detail: 'Look at your vehicle\'s charging port or manual and make sure the charger lists the same connector. A connector that looks similar is not always compatible.' },
  { title: 'Reserve or wait for your turn', detail: 'Press Book now to hold a slot. If the charger is busy, EVRoute shows how long the current session has left and lets you wait for your turn.' },
  { title: 'Use the Call button if you are stuck', detail: 'Once you have a booking, the Call button on the charger page connects you to the owner. You never need to see or type the number.' },
];

export const GUIDES: Guide[] = [
  {
    key: 'ccs2', name: 'CCS2 (DC fast)', short: 'CCS2', chargerFilter: { type: 'fast_dc', connector: 'CCS2' },
    usedFor: 'Most modern electric cars in India (Tata, MG, Hyundai, Kia, BYD, Mahindra and others).',
    speed: 'About 25 to 350 kW. Typically 20 to 80% in 30 to 60 minutes.',
    videoId: '0grtFNVkgIo', videoTitle: 'Charging an EV at a public station, step by step',
    videoNote: 'This walkthrough was filmed at a public station elsewhere; the steps are the same, but the screen and app will differ.',
    steps: [
      { title: 'Park and switch off', detail: 'Park so the cable reaches your charge port without stretching. Put the car in Park, apply the handbrake and switch the car off.' },
      { title: 'Open the charge port', detail: 'Open the charge flap. The CCS2 port looks like a round Type 2 socket with two large pins underneath. Check for dirt or water.' },
      { title: 'Start the session on the charger', detail: 'Scan the QR code with the operator\'s app, tap an RFID card, or follow the touch screen. Most stations need an app account and a wallet balance first.' },
      { title: 'Choose how much to charge', detail: 'Some chargers ask for a time, an amount in rupees or a kWh target. If you are unsure, choose the full session and stop it yourself.' },
      { title: 'Plug in the CCS2 gun', detail: 'Hold the gun by the handle and push it straight into the port until it clicks. The charger locks the plug in place and checks the car before power flows.' },
      { title: 'Confirm charging has started', detail: 'The charger screen, your dashboard and the app should all show charging and the power in kW. If nothing happens after a minute, unplug, wait ten seconds and try again.' },
      { title: 'Stop at about 80%', detail: 'Charging slows a lot after 80%. For a trip it is usually faster to stop at 80% and leave the charger free for the next driver.' },
      { title: 'Stop, unplug and pay', detail: 'End the session on the app or screen first, wait for the lock to release, then pull the gun out and hang it back on the holder. Close the flap. Check the receipt in the app.' },
    ],
    tips: ['Never pull the gun out while charging is running.', 'Do not leave your car plugged in after it is done. Many stations charge idle fees.', 'In heavy rain the charger is still safe to use. Keep the plug end dry and off the ground.'],
  },
  {
    key: 'chademo', name: 'CHAdeMO (DC fast)', short: 'CHAdeMO', chargerFilter: { type: 'fast_dc', connector: 'CHAdeMO' },
    usedFor: 'Older and some imported electric cars, such as the Nissan Leaf and some Mitsubishi and Japanese-built models.',
    speed: 'Usually 20 to 50 kW on older units. Typically 40 to 60 minutes for 20 to 80%.',
    videoId: '269qO5ecNOQ', videoTitle: 'How to use a DC CHAdeMO charger',
    videoNote: 'Filmed at a UK station; the CHAdeMO plug works the same way everywhere.',
    steps: [
      { title: 'Park and switch off', detail: 'Park close to the charger, apply the handbrake and switch the car off.' },
      { title: 'Open the CHAdeMO port', detail: 'CHAdeMO is a separate, round port, usually next to the normal AC port. Open its cover.' },
      { title: 'Authenticate on the charger', detail: 'Scan the QR code, use the operator\'s app or tap an RFID card, then select the CHAdeMO connector on the screen.' },
      { title: 'Press the release button and insert', detail: 'CHAdeMO plugs have a latch. Hold the handle, push the plug fully in until it seats, then release the latch so it locks.' },
      { title: 'Wait for the handshake', detail: 'The charger and car talk to each other first. Charging begins after a few seconds and the screen shows kW and the percentage added.' },
      { title: 'Stop and release', detail: 'End the session on the screen or app. Wait until the plug unlocks, press the latch and pull the plug straight out. Put it back on the holder and close the cover.' },
    ],
    tips: ['The latch has to be pressed in the right order. If the plug will not come out, stop the session again and wait a few seconds.', 'Many newer stations in India do not have CHAdeMO. Check the connector list on EVRoute before you drive there.'],
  },
  {
    key: 'gbt', name: 'GB/T (DC fast)', short: 'GB/T', chargerFilter: { type: 'fast_dc', connector: 'GB/T' },
    usedFor: 'Older public DC chargers (Bharat DC-001), some electric buses and vehicles built to the Chinese standard.',
    speed: 'Often about 15 kW on older Bharat DC units, so expect 1 to 2 hours for a top-up.',
    videoId: 'B-sYRby3JTM', videoTitle: 'EV fast charging at a public DC charging station',
    videoNote: 'There is no dedicated GB/T walkthrough here. This is a general DC fast-charging demonstration; the GB/T steps follow the same order.',
    steps: [
      { title: 'Confirm your vehicle has a GB/T DC port', detail: 'Check the manual. GB/T AC and GB/T DC are different connectors, and the DC one is the larger plug.' },
      { title: 'Park, handbrake, switch off', detail: 'Park within easy reach of the cable and switch the vehicle off.' },
      { title: 'Authenticate', detail: 'Use the operator\'s app, QR code or RFID card as shown on the charger. Older units may use a simple start button or a key.' },
      { title: 'Plug in the GB/T gun', detail: 'Open the DC port cover, line up the plug and push it fully in until it clicks.' },
      { title: 'Start charging', detail: 'Select the connector and start the session. Confirm on the vehicle display that charging has begun.' },
      { title: 'Stop and unplug', detail: 'End the session first, wait for the lock to release, then unplug and return the gun to its holder.' },
    ],
    tips: ['Older units can be unreliable. Check the latest status on EVRoute and report what you find so the next driver knows.', 'If the plug will not lock, do not force it. Try another connector or station.'],
  },
  {
    key: 'type2', name: 'Type 2 (slow AC)', short: 'Type 2', chargerFilter: { type: 'slow_ac', connector: 'Type2' },
    usedFor: 'Home, hotel, mall, office and destination charging for most electric cars in India.',
    speed: 'About 3.3 to 22 kW. A full charge is usually 4 to 10 hours, so it suits overnight or long stops.',
    videoId: '2Q3myuNde98', videoTitle: 'How to use an AC EV charger',
    steps: [
      { title: 'Check what the charger needs', detail: 'Some Type 2 points have a fixed cable attached. Others only have a socket and expect you to bring your own Type 2 cable. Check the charger page and carry a cable if unsure.' },
      { title: 'Park and switch off', detail: 'Park so the cable reaches your port, put the car in Park and switch off.' },
      { title: 'Open the charge port', detail: 'Open the flap. A Type 2 port is round with a flat top edge and no large pins underneath.' },
      { title: 'Connect the cable', detail: 'If you use your own cable, plug it into the charger first and then into the car. Push each end in until it clicks.' },
      { title: 'Start the session', detail: 'Some points start as soon as the car is plugged in. Others need the app, an RFID card or a start button. Wait for the indicator light to show charging.' },
      { title: 'Set a limit if you can', detail: 'Many cars let you set a charge limit from the dashboard or the manufacturer\'s app. Daily charging to 80% is gentler on the battery.' },
      { title: 'Stop and disconnect', detail: 'End the session on the app or unlock the car. The cable will release. Unplug the car end first, then the charger end, and coil the cable neatly.' },
    ],
    tips: ['AC charging is slow by design. It is the best choice when you will be parked for a few hours.', 'A cable left coiled on the ground is a trip hazard and wears out. Hang it up.', 'Do not use a damaged cable or a socket that feels hot.'],
  },
  {
    key: 'socket15', name: '15A socket (bikes and scooters)', short: '15A socket', chargerFilter: { type: 'slow_ac', connector: '15A socket' },
    usedFor: 'Electric scooters and bikes (TVS iQube, Ather, Ola, Bajaj Chetak and others) using the portable charger that comes with the vehicle.',
    speed: 'About 0.65 to 3.3 kW. Usually 4 to 6 hours for a full charge.',
    videoId: '2-z6ojaQtQg', videoTitle: 'Easy charge with TVS iQube (portable charger at a 15A plug point)',
    videoNote: 'Shown on a TVS iQube; other scooters with a portable charger follow the same steps.',
    steps: [
      { title: 'Use a 15A point, not a 5A point', detail: 'The 15A socket is the larger three-pin socket used for geysers and air conditioners. A 5A socket (phone charger or fan type) can overheat.' },
      { title: 'Look at the socket first', detail: 'It should be firm, clean, dry and properly earthed. Do not use a loose, blackened or warm socket.' },
      { title: 'Plug the charger into the wall first', detail: 'Connect your portable charger to the wall socket and switch the socket on. Check that the charger\'s indicator light comes on.' },
      { title: 'Open the vehicle charge port', detail: 'Switch off the scooter, open the charge cover and make sure the port is dry and clear.' },
      { title: 'Connect to the vehicle', detail: 'Push the charger plug into the port until it is fully seated. The dashboard or app should show that charging has started.' },
      { title: 'Charge, then disconnect', detail: 'When the charge is done, unplug from the vehicle first, then switch off and remove the charger from the wall. Close the cover firmly.' },
    ],
    tips: ['Avoid extension cords and multi-plugs. They are a common cause of overheating.', 'Charge in the shade and keep the charger off wet ground.', 'If the owner of a shared point gives you a time window, finish and move on so the next rider can charge.'],
  },
  {
    key: 'swap', name: 'Battery swap (e-scooters)', short: 'Battery swap', chargerFilter: { type: 'swap' },
    usedFor: 'Scooters, e-rickshaws and delivery vehicles with a removable battery that works on the swap network.',
    speed: 'A swap takes about 1 to 3 minutes. No waiting for the battery to charge.',
    videoId: 'cZAYQDMyPQ8', videoTitle: 'How to swap a battery, step by step (SUN Mobility)',
    videoNote: 'Shown on one swap network. Other networks use their own batteries and apps, but the order is the same.',
    steps: [
      { title: 'Check your vehicle is supported', detail: 'Only vehicles with a removable battery that suits the network can swap. Batteries from one network usually do not work at another network\'s stations.' },
      { title: 'Register in the network\'s app', detail: 'Create an account, complete any ID verification and choose a plan or a pay-per-swap option.' },
      { title: 'Ride to a station with charged batteries', detail: 'Use the app or EVRoute to find a station and check that it has fully charged batteries available.' },
      { title: 'Park and switch off', detail: 'Stop at the swap point, switch the vehicle off and take the key out if the compartment is locked.' },
      { title: 'Authenticate', detail: 'Scan the QR code on the station or the app to start the swap. An attendant may do this for you.' },
      { title: 'Remove the empty battery', detail: 'Unlock the compartment, release the latch and slide the depleted battery out. It is heavy, so lift with both hands or let the attendant help.' },
      { title: 'Insert the charged battery', detail: 'Slide the full battery into the compartment until it clicks, close and lock it, and check the vehicle shows the new charge level.' },
      { title: 'Pay and check the receipt', detail: 'The app charges you for the energy or the plan. Check the receipt and ride on.' },
    ],
    tips: ['Never open or tamper with a battery pack.', 'If a battery shows a low charge or a fault, ask for another one right away.', 'EVRoute shows swap stations on the map with the letter B.'],
  },
];
