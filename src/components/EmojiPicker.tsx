'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'

interface EmojiItem {
  emoji: string
  keywords: string[]
}

interface EmojiCategory {
  id: string
  name: string
  icon: string
  emojis: EmojiItem[]
}

// Clean Unicode-only Emoji Dataset (Strictly no text names/labels)
const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      { emoji: '😀', keywords: ['grinning', 'smile', 'happy'] },
      { emoji: '😃', keywords: ['smiley', 'happy', 'joy'] },
      { emoji: '😄', keywords: ['smile', 'happy', 'laugh'] },
      { emoji: '😁', keywords: ['grin', 'happy', 'smile'] },
      { emoji: '😆', keywords: ['laughing', 'satisfied', 'haha'] },
      { emoji: '😅', keywords: ['sweat_smile', 'relief'] },
      { emoji: '😂', keywords: ['joy', 'tears', 'laugh', 'lol'] },
      { emoji: '🤣', keywords: ['rofl', 'laughing', 'lol'] },
      { emoji: '🥹', keywords: ['holding_back_tears', 'emotional'] },
      { emoji: '😊', keywords: ['blush', 'smile', 'happy'] },
      { emoji: '😇', keywords: ['angel', 'halo', 'innocent'] },
      { emoji: '🙂', keywords: ['slightly_smiling_face', 'smile'] },
      { emoji: '🙃', keywords: ['upside_down', 'silly'] },
      { emoji: '😉', keywords: ['wink', 'flirt'] },
      { emoji: '😌', keywords: ['relieved', 'peaceful'] },
      { emoji: '😍', keywords: ['heart_eyes', 'love', 'crush'] },
      { emoji: '🥰', keywords: ['hearts', 'love', 'affection'] },
      { emoji: '😘', keywords: ['kiss', 'blow_kiss', 'love'] },
      { emoji: '😗', keywords: ['kissing'] },
      { emoji: '😙', keywords: ['kissing_smiling_eyes'] },
      { emoji: '😚', keywords: ['kissing_closed_eyes'] },
      { emoji: '😋', keywords: ['yum', 'delicious', 'tasty'] },
      { emoji: '😛', keywords: ['stuck_out_tongue', 'silly'] },
      { emoji: '😜', keywords: ['wink_tongue', 'crazy'] },
      { emoji: '🤪', keywords: ['zany', 'goofy', 'wild'] },
      { emoji: '😝', keywords: ['tongue_closed_eyes'] },
      { emoji: '🤑', keywords: ['money_mouth', 'rich'] },
      { emoji: '🤗', keywords: ['hugging', 'hug'] },
      { emoji: '🤭', keywords: ['hand_over_mouth', 'giggle'] },
      { emoji: '🫢', keywords: ['surprised', 'gasp'] },
      { emoji: '🫣', keywords: ['peeking', 'shy'] },
      { emoji: '🤫', keywords: ['shushing', 'quiet', 'secret'] },
      { emoji: '🤔', keywords: ['thinking', 'wonder'] },
      { emoji: '🫡', keywords: ['saluting', 'respect'] },
      { emoji: '🤐', keywords: ['zipper_mouth', 'secret'] },
      { emoji: '🤨', keywords: ['raised_eyebrow', 'skeptical'] },
      { emoji: '😐', keywords: ['neutral', 'meh'] },
      { emoji: '😑', keywords: ['expressionless'] },
      { emoji: '😶', keywords: ['no_mouth', 'silent'] },
      { emoji: '🫥', keywords: ['dotted_line_face', 'invisible'] },
      { emoji: '😏', keywords: ['smirk', 'sly', 'cool'] },
      { emoji: '😒', keywords: ['unamused', 'bored'] },
      { emoji: '🙄', keywords: ['eye_roll', 'whatever'] },
      { emoji: '😬', keywords: ['grimacing', 'nervous'] },
      { emoji: '😮‍💨', keywords: ['sigh', 'relief'] },
      { emoji: '🤥', keywords: ['lying', 'pinocchio'] },
      { emoji: '😔', keywords: ['pensive', 'sad'] },
      { emoji: '😪', keywords: ['sleepy', 'tired'] },
      { emoji: '🤤', keywords: ['drooling'] },
      { emoji: '😴', keywords: ['sleeping', 'zzz'] },
      { emoji: '😷', keywords: ['mask', 'sick'] },
      { emoji: '🤒', keywords: ['thermometer', 'sick'] },
      { emoji: '🤕', keywords: ['bandage', 'hurt'] },
      { emoji: '🤢', keywords: ['nauseated', 'sick'] },
      { emoji: '🤮', keywords: ['vomiting', 'sick'] },
      { emoji: '🤧', keywords: ['sneezing', 'sick'] },
      { emoji: '🥵', keywords: ['hot_face', 'heat'] },
      { emoji: '🥶', keywords: ['cold_face', 'freezing'] },
      { emoji: '🥴', keywords: ['woozy', 'dizzy'] },
      { emoji: '😵', keywords: ['dizzy'] },
      { emoji: '🤯', keywords: ['exploding_head', 'mind_blown'] },
      { emoji: '🤠', keywords: ['cowboy'] },
      { emoji: '🥳', keywords: ['partying', 'celebrate', 'party'] },
      { emoji: '🥸', keywords: ['disguise'] },
      { emoji: '😎', keywords: ['sunglasses', 'cool'] },
      { emoji: '🤓', keywords: ['nerd', 'geek'] },
      { emoji: '🧐', keywords: ['monocle', 'curious'] },
      { emoji: '😕', keywords: ['confused'] },
      { emoji: '😟', keywords: ['worried'] },
      { emoji: '🙁', keywords: ['slightly_frowning'] },
      { emoji: '😮', keywords: ['open_mouth', 'surprised'] },
      { emoji: '😯', keywords: ['hushed'] },
      { emoji: '😲', keywords: ['astonished', 'shocked'] },
      { emoji: '😳', keywords: ['flushed', 'blush', 'embarrassed'] },
      { emoji: '🥺', keywords: ['pleading', 'puppy_eyes'] },
      { emoji: '😦', keywords: ['frowning_open_mouth'] },
      { emoji: '😧', keywords: ['anguished'] },
      { emoji: '😨', keywords: ['fearful', 'scared'] },
      { emoji: '😰', keywords: ['anxious_sweat'] },
      { emoji: '😥', keywords: ['sad_relieved'] },
      { emoji: '😢', keywords: ['crying', 'sad'] },
      { emoji: '😭', keywords: ['sob', 'crying', 'tears'] },
      { emoji: '😱', keywords: ['scream', 'scared'] },
      { emoji: '😖', keywords: ['confounded'] },
      { emoji: '😣', keywords: ['persevering'] },
      { emoji: '😞', keywords: ['disappointed'] },
      { emoji: '😓', keywords: ['downcast_sweat'] },
      { emoji: '😩', keywords: ['weary'] },
      { emoji: '😫', keywords: ['tired'] },
      { emoji: '🥱', keywords: ['yawning'] },
      { emoji: '😤', keywords: ['triumph', 'angry'] },
      { emoji: '😡', keywords: ['rage', 'angry'] },
      { emoji: '😠', keywords: ['angry'] },
      { emoji: '🤬', keywords: ['cursing', 'angry'] },
      { emoji: '😈', keywords: ['smiling_imp', 'devil'] },
      { emoji: '👿', keywords: ['imp', 'devil'] },
      { emoji: '💀', keywords: ['skull', 'dead'] },
      { emoji: '☠️', keywords: ['skull_crossbones'] },
      { emoji: '💩', keywords: ['poop', 'shit'] },
      { emoji: '🤡', keywords: ['clown'] },
      { emoji: '👹', keywords: ['ogre'] },
      { emoji: '👺', keywords: ['goblin'] },
      { emoji: '👻', keywords: ['ghost', 'halloween', 'spooky'] },
      { emoji: '👽', keywords: ['alien'] },
      { emoji: '👾', keywords: ['space_invader', 'game'] },
      { emoji: '🤖', keywords: ['robot'] }
    ]
  },
  {
    id: 'people',
    name: 'People & Body',
    icon: '👋',
    emojis: [
      { emoji: '👋', keywords: ['wave', 'hello', 'bye'] },
      { emoji: '🤚', keywords: ['raised_back_hand'] },
      { emoji: '🖐️', keywords: ['hand_splayed'] },
      { emoji: '✋', keywords: ['raised_hand', 'stop'] },
      { emoji: '🖖', keywords: ['vulcan', 'spock'] },
      { emoji: '🫱', keywords: ['rightward_hand'] },
      { emoji: '🫲', keywords: ['leftward_hand'] },
      { emoji: '🫳', keywords: ['palm_down'] },
      { emoji: '🫴', keywords: ['palm_up'] },
      { emoji: '👌', keywords: ['ok', 'perfect'] },
      { emoji: '🤌', keywords: ['pinched_fingers'] },
      { emoji: '🤏', keywords: ['pinching_hand', 'small'] },
      { emoji: '✌️', keywords: ['peace', 'victory'] },
      { emoji: '🤞', keywords: ['crossed_fingers', 'luck'] },
      { emoji: '🫰', keywords: ['hand_heart', 'love'] },
      { emoji: '🤟', keywords: ['love_you', 'rock'] },
      { emoji: '🤘', keywords: ['rock_on'] },
      { emoji: '🤙', keywords: ['call_me'] },
      { emoji: '👈', keywords: ['point_left'] },
      { emoji: '👉', keywords: ['point_right'] },
      { emoji: '👆', keywords: ['point_up'] },
      { emoji: '🖕', keywords: ['middle_finger'] },
      { emoji: '👇', keywords: ['point_down'] },
      { emoji: '☝️', keywords: ['point_up_one'] },
      { emoji: '🫵', keywords: ['point_at_you'] },
      { emoji: '👍', keywords: ['thumbs_up', 'like', 'yes', 'good'] },
      { emoji: '👎', keywords: ['thumbs_down', 'dislike', 'no'] },
      { emoji: '✊', keywords: ['fist', 'power'] },
      { emoji: '👊', keywords: ['punch', 'fistbump'] },
      { emoji: '🤛', keywords: ['left_fistbump'] },
      { emoji: '🤜', keywords: ['right_fistbump'] },
      { emoji: '👏', keywords: ['clap', 'applause'] },
      { emoji: '🙌', keywords: ['raising_hands', 'praise'] },
      { emoji: '🫶', keywords: ['heart_hands', 'love'] },
      { emoji: '👐', keywords: ['open_hands'] },
      { emoji: '🤲', keywords: ['palms_up_together'] },
      { emoji: '🤝', keywords: ['handshake', 'deal'] },
      { emoji: '🙏', keywords: ['pray', 'please', 'thanks'] },
      { emoji: '✍️', keywords: ['writing_hand'] },
      { emoji: '💅', keywords: ['nail_polish', 'slay'] },
      { emoji: '🤳', keywords: ['selfie'] },
      { emoji: '💪', keywords: ['flex', 'strong', 'muscle', 'gym'] },
      { emoji: '🦵', keywords: ['leg'] },
      { emoji: '🦶', keywords: ['foot'] },
      { emoji: '👂', keywords: ['ear', 'listen'] },
      { emoji: '🫁', keywords: ['lungs'] },
      { emoji: '🧠', keywords: ['brain', 'smart'] },
      { emoji: '👀', keywords: ['eyes', 'look', 'watching'] },
      { emoji: '👁️', keywords: ['eye'] },
      { emoji: '👅', keywords: ['tongue'] },
      { emoji: '👄', keywords: ['mouth', 'lips'] },
      { emoji: '🫦', keywords: ['biting_lip', 'flirt'] },
      { emoji: '👶', keywords: ['baby'] },
      { emoji: '🧒', keywords: ['child', 'kid'] },
      { emoji: '👦', keywords: ['boy'] },
      { emoji: '👧', keywords: ['girl'] },
      { emoji: '🧑', keywords: ['person'] },
      { emoji: '👱', keywords: ['blond'] },
      { emoji: '👨', keywords: ['man', 'guy'] },
      { emoji: '🧔', keywords: ['beard'] },
      { emoji: '👩', keywords: ['woman', 'lady'] },
      { emoji: '🧓', keywords: ['older_person'] },
      { emoji: '👴', keywords: ['old_man'] },
      { emoji: '👵', keywords: ['old_woman'] },
      { emoji: '🧑‍⚕️', keywords: ['doctor', 'health'] },
      { emoji: '🧑‍🎓', keywords: ['student', 'uni', 'college'] },
      { emoji: '🧑‍🏫', keywords: ['teacher'] },
      { emoji: '🧑‍⚖️', keywords: ['judge'] },
      { emoji: '🧑‍💻', keywords: ['coder', 'developer', 'laptop'] },
      { emoji: '💃', keywords: ['dancer', 'dance'] },
      { emoji: '🕺', keywords: ['man_dancing'] },
      { emoji: '👯', keywords: ['dancing_people'] },
      { emoji: '🚶', keywords: ['walking'] },
      { emoji: '🏃', keywords: ['running', 'runner'] },
      { emoji: '🧍', keywords: ['standing'] },
      { emoji: '🧎', keywords: ['kneeling'] },
      { emoji: '👨‍👩‍👧‍👦', keywords: ['family'] },
      { emoji: '👩‍❤️‍👨', keywords: ['couple'] }
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      { emoji: '🐶', keywords: ['dog', 'puppy', 'pet'] },
      { emoji: '🐱', keywords: ['cat', 'kitten', 'pet'] },
      { emoji: '🐭', keywords: ['mouse'] },
      { emoji: '🐹', keywords: ['hamster'] },
      { emoji: '🐰', keywords: ['rabbit', 'bunny'] },
      { emoji: '🦊', keywords: ['fox'] },
      { emoji: '🐻', keywords: ['bear'] },
      { emoji: '🐼', keywords: ['panda'] },
      { emoji: '🐻‍❄️', keywords: ['polar_bear'] },
      { emoji: '🐨', keywords: ['koala'] },
      { emoji: '🐯', keywords: ['tiger'] },
      { emoji: '🦁', keywords: ['lion'] },
      { emoji: '🐮', keywords: ['cow'] },
      { emoji: '🐷', keywords: ['pig'] },
      { emoji: '🐸', keywords: ['frog'] },
      { emoji: '🐵', keywords: ['monkey'] },
      { emoji: '🙈', keywords: ['see_no_evil', 'shy'] },
      { emoji: '🙉', keywords: ['hear_no_evil'] },
      { emoji: '🙊', keywords: ['speak_no_evil'] },
      { emoji: '🐔', keywords: ['chicken'] },
      { emoji: '🐧', keywords: ['penguin'] },
      { emoji: '🐦', keywords: ['bird'] },
      { emoji: '🐤', keywords: ['baby_chick'] },
      { emoji: '🦆', keywords: ['duck'] },
      { emoji: '🦅', keywords: ['eagle'] },
      { emoji: '🦉', keywords: ['owl'] },
      { emoji: '🦇', keywords: ['bat'] },
      { emoji: '🐺', keywords: ['wolf'] },
      { emoji: '🐗', keywords: ['boar'] },
      { emoji: '🐴', keywords: ['horse'] },
      { emoji: '🦄', keywords: ['unicorn'] },
      { emoji: '🐝', keywords: ['bee'] },
      { emoji: '🐛', keywords: ['caterpillar'] },
      { emoji: '🦋', keywords: ['butterfly'] },
      { emoji: '🐌', keywords: ['snail'] },
      { emoji: '🐞', keywords: ['ladybug'] },
      { emoji: '🐜', keywords: ['ant'] },
      { emoji: '🦟', keywords: ['mosquito'] },
      { emoji: '🐢', keywords: ['turtle'] },
      { emoji: '🐍', keywords: ['snake'] },
      { emoji: '🦎', keywords: ['lizard'] },
      { emoji: '🦖', keywords: ['dinosaur'] },
      { emoji: '🐙', keywords: ['octopus'] },
      { emoji: '🦑', keywords: ['squid'] },
      { emoji: '🦐', keywords: ['shrimp'] },
      { emoji: '🦞', keywords: ['lobster'] },
      { emoji: '🦀', keywords: ['crab'] },
      { emoji: '🐡', keywords: ['blowfish'] },
      { emoji: '🐠', keywords: ['tropical_fish'] },
      { emoji: '🐟', keywords: ['fish'] },
      { emoji: '🐬', keywords: ['dolphin'] },
      { emoji: '🐳', keywords: ['whale'] },
      { emoji: '🐋', keywords: ['whale'] },
      { emoji: '🦈', keywords: ['shark'] },
      { emoji: '🦭', keywords: ['seal'] },
      { emoji: '🐊', keywords: ['crocodile'] },
      { emoji: '🐅', keywords: ['tiger'] },
      { emoji: '🐆', keywords: ['leopard'] },
      { emoji: '🐘', keywords: ['elephant'] },
      { emoji: '🦛', keywords: ['hippo'] },
      { emoji: '🦏', keywords: ['rhino'] },
      { emoji: '🐪', keywords: ['camel'] },
      { emoji: '🦒', keywords: ['giraffe'] },
      { emoji: '🦘', keywords: ['kangaroo'] },
      { emoji: '🦬', keywords: ['bison'] },
      { emoji: '🌲', keywords: ['tree', 'forest'] },
      { emoji: '🌳', keywords: ['tree'] },
      { emoji: '🌴', keywords: ['palm_tree', 'beach'] },
      { emoji: '🌵', keywords: ['cactus'] },
      { emoji: '🌾', keywords: ['rice'] },
      { emoji: '🌿', keywords: ['herb', 'leaf'] },
      { emoji: '☘️', keywords: ['shamrock', 'clover'] },
      { emoji: '🍀', keywords: ['four_leaf_clover', 'luck'] },
      { emoji: '🍁', keywords: ['maple_leaf', 'fall'] },
      { emoji: '🍂', keywords: ['fallen_leaf'] },
      { emoji: '🍃', keywords: ['leaf_in_wind'] },
      { emoji: '🌺', keywords: ['hibiscus', 'flower'] },
      { emoji: '🌸', keywords: ['cherry_blossom', 'pink'] },
      { emoji: '🌹', keywords: ['rose', 'love'] },
      { emoji: '🌷', keywords: ['tulip'] },
      { emoji: '🌻', keywords: ['sunflower'] },
      { emoji: '🌼', keywords: ['blossom'] },
      { emoji: '💐', keywords: ['bouquet'] },
      { emoji: '🍄', keywords: ['mushroom'] }
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: [
      { emoji: '🍕', keywords: ['pizza', 'cheese'] },
      { emoji: '🍔', keywords: ['burger', 'fastfood'] },
      { emoji: '🍟', keywords: ['fries', 'fastfood'] },
      { emoji: '🌭', keywords: ['hotdog'] },
      { emoji: '🍿', keywords: ['popcorn', 'movie'] },
      { emoji: '🥓', keywords: ['bacon'] },
      { emoji: '🥚', keywords: ['egg'] },
      { emoji: '🍳', keywords: ['cooking', 'egg'] },
      { emoji: '🥞', keywords: ['pancakes'] },
      { emoji: '🧇', keywords: ['waffle'] },
      { emoji: '🧀', keywords: ['cheese'] },
      { emoji: '🍗', keywords: ['chicken'] },
      { emoji: '🍖', keywords: ['meat'] },
      { emoji: '🥩', keywords: ['steak'] },
      { emoji: '🌮', keywords: ['taco'] },
      { emoji: '🌯', keywords: ['burrito'] },
      { emoji: '🥙', keywords: ['shawarma'] },
      { emoji: '🧆', keywords: ['falafel'] },
      { emoji: '🍜', keywords: ['ramen', 'noodles'] },
      { emoji: '🍝', keywords: ['spaghetti', 'pasta'] },
      { emoji: '🍞', keywords: ['bread'] },
      { emoji: '🥐', keywords: ['croissant'] },
      { emoji: '🥖', keywords: ['baguette'] },
      { emoji: '🥨', keywords: ['pretzel'] },
      { emoji: '🥯', keywords: ['bagel'] },
      { emoji: '🍚', keywords: ['rice'] },
      { emoji: '🍛', keywords: ['curry'] },
      { emoji: '🍣', keywords: ['sushi'] },
      { emoji: '🍱', keywords: ['bento'] },
      { emoji: '🥟', keywords: ['dumpling'] },
      { emoji: '🍡', keywords: ['dango'] },
      { emoji: '🍧', keywords: ['shaved_ice'] },
      { emoji: '🍨', keywords: ['ice_cream'] },
      { emoji: '🍦', keywords: ['soft_ice_cream'] },
      { emoji: '🥧', keywords: ['pie'] },
      { emoji: '🧁', keywords: ['cupcake'] },
      { emoji: '🍰', keywords: ['cake'] },
      { emoji: '🎂', keywords: ['birthday_cake'] },
      { emoji: '🍮', keywords: ['custard'] },
      { emoji: '🍭', keywords: ['lollipop'] },
      { emoji: '🍬', keywords: ['candy'] },
      { emoji: '🍫', keywords: ['chocolate'] },
      { emoji: '🍩', keywords: ['donut'] },
      { emoji: '🍪', keywords: ['cookie'] },
      { emoji: '🍯', keywords: ['honey'] },
      { emoji: '🍏', keywords: ['apple', 'fruit'] },
      { emoji: '🍎', keywords: ['red_apple'] },
      { emoji: '🍐', keywords: ['pear'] },
      { emoji: '🍊', keywords: ['orange'] },
      { emoji: '🍋', keywords: ['lemon'] },
      { emoji: '🍌', keywords: ['banana'] },
      { emoji: '🍉', keywords: ['watermelon'] },
      { emoji: '🍇', keywords: ['grapes'] },
      { emoji: '🍓', keywords: ['strawberry'] },
      { emoji: '🫐', keywords: ['blueberries'] },
      { emoji: '🍈', keywords: ['melon'] },
      { emoji: '🍒', keywords: ['cherries'] },
      { emoji: '🍑', keywords: ['peach'] },
      { emoji: '🥭', keywords: ['mango'] },
      { emoji: '🍍', keywords: ['pineapple'] },
      { emoji: '🥥', keywords: ['coconut'] },
      { emoji: '🥝', keywords: ['kiwi', 'fruit'] },
      { emoji: '🥑', keywords: ['avocado'] },
      { emoji: '🍆', keywords: ['eggplant'] },
      { emoji: '🥦', keywords: ['broccoli'] },
      { emoji: '🌽', keywords: ['corn'] },
      { emoji: '🌶️', keywords: ['spicy'] },
      { emoji: '🧄', keywords: ['garlic'] },
      { emoji: '🧅', keywords: ['onion'] },
      { emoji: '🥔', keywords: ['potato'] },
      { emoji: '🍠', keywords: ['sweet_potato'] },
      { emoji: '☕', keywords: ['coffee', 'tea', 'cafe'] },
      { emoji: '🫖', keywords: ['teapot'] },
      { emoji: '🍵', keywords: ['green_tea'] },
      { emoji: '🧃', keywords: ['juice'] },
      { emoji: '🥤', keywords: ['soda'] },
      { emoji: '🧋', keywords: ['bubble_tea', 'boba'] },
      { emoji: '🍺', keywords: ['beer'] },
      { emoji: '🍻', keywords: ['cheers', 'beers'] },
      { emoji: '🥂', keywords: ['toast'] },
      { emoji: '🍷', keywords: ['wine'] },
      { emoji: '🥃', keywords: ['whiskey'] },
      { emoji: '🍸', keywords: ['cocktail'] },
      { emoji: '🍹', keywords: ['tropical_drink'] },
      { emoji: '🍾', keywords: ['champagne'] },
      { emoji: '🧊', keywords: ['ice'] }
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '🚗',
    emojis: [
      { emoji: '🚗', keywords: ['car', 'drive'] },
      { emoji: '🚕', keywords: ['taxi'] },
      { emoji: '🚙', keywords: ['suv'] },
      { emoji: '🚌', keywords: ['bus'] },
      { emoji: '🏎️', keywords: ['racing_car'] },
      { emoji: '🚓', keywords: ['police_car'] },
      { emoji: '🚑', keywords: ['ambulance'] },
      { emoji: '🚒', keywords: ['fire_engine'] },
      { emoji: '🚚', keywords: ['delivery_truck'] },
      { emoji: '🚜', keywords: ['tractor'] },
      { emoji: '🛵', keywords: ['scooter'] },
      { emoji: '🏍️', keywords: ['motorcycle'] },
      { emoji: '🚲', keywords: ['bicycle'] },
      { emoji: '🛴', keywords: ['kick_scooter'] },
      { emoji: '🚨', keywords: ['siren', 'warning'] },
      { emoji: '🚥', keywords: ['traffic_light'] },
      { emoji: '🗺️', keywords: ['map', 'travel'] },
      { emoji: '🗿', keywords: ['moai'] },
      { emoji: '🗽', keywords: ['statue_of_liberty'] },
      { emoji: '🗼', keywords: ['tokyo_tower'] },
      { emoji: '🏰', keywords: ['castle'] },
      { emoji: '🏯', keywords: ['japanese_castle'] },
      { emoji: '🏟️', keywords: ['stadium'] },
      { emoji: '🎡', keywords: ['ferris_wheel'] },
      { emoji: '🎢', keywords: ['roller_coaster'] },
      { emoji: '🎠', keywords: ['carousel'] },
      { emoji: '⛲', keywords: ['fountain'] },
      { emoji: '🏖️', keywords: ['beach', 'vacation'] },
      { emoji: '🏝️', keywords: ['island'] },
      { emoji: '🏜️', keywords: ['desert'] },
      { emoji: '🌋', keywords: ['volcano'] },
      { emoji: '⛰️', keywords: ['mountain'] },
      { emoji: '🏔️', keywords: ['snow_mountain'] },
      { emoji: '🏕️', keywords: ['camping'] },
      { emoji: '⛺', keywords: ['tent'] },
      { emoji: '🏠', keywords: ['house', 'home'] },
      { emoji: '🏡', keywords: ['house_garden'] },
      { emoji: '🏢', keywords: ['office'] },
      { emoji: '🏥', keywords: ['hospital'] },
      { emoji: '🏦', keywords: ['bank'] },
      { emoji: '🏨', keywords: ['hotel'] },
      { emoji: '🏪', keywords: ['convenience_store'] },
      { emoji: '🏫', keywords: ['school', 'uni'] },
      { emoji: '🏬', keywords: ['store'] },
      { emoji: '🏭', keywords: ['factory'] },
      { emoji: '💒', keywords: ['wedding'] },
      { emoji: '🏛️', keywords: ['classical_building'] },
      { emoji: '✈️', keywords: ['airplane', 'flight', 'travel'] },
      { emoji: '🛫', keywords: ['takeoff'] },
      { emoji: '🛬', keywords: ['landing'] },
      { emoji: '🚀', keywords: ['rocket', 'launch'] },
      { emoji: '🛸', keywords: ['ufo'] },
      { emoji: '🚁', keywords: ['helicopter'] },
      { emoji: '🛶', keywords: ['canoe'] },
      { emoji: '⛵', keywords: ['sailboat'] },
      { emoji: '🛥️', keywords: ['motorboat'] },
      { emoji: '🛳️', keywords: ['cruise'] },
      { emoji: '⚓', keywords: ['anchor'] }
    ]
  },
  {
    id: 'activities',
    name: 'Activities & Sports',
    icon: '⚽',
    emojis: [
      { emoji: '⚽', keywords: ['soccer', 'football'] },
      { emoji: '🏀', keywords: ['basketball'] },
      { emoji: '🏈', keywords: ['american_football'] },
      { emoji: '⚾', keywords: ['baseball'] },
      { emoji: '🥎', keywords: ['softball'] },
      { emoji: '🎾', keywords: ['tennis'] },
      { emoji: '🏐', keywords: ['volleyball'] },
      { emoji: '🏉', keywords: ['rugby'] },
      { emoji: '🥏', keywords: ['frisbee'] },
      { emoji: '🎱', keywords: ['pool_8_ball'] },
      { emoji: '🏓', keywords: ['ping_pong'] },
      { emoji: '🏸', keywords: ['badminton'] },
      { emoji: '🏒', keywords: ['hockey'] },
      { emoji: '🥊', keywords: ['boxing'] },
      { emoji: '🥋', keywords: ['karate'] },
      { emoji: '🎽', keywords: ['running_shirt'] },
      { emoji: '🛹', keywords: ['skateboard'] },
      { emoji: '🛼', keywords: ['roller_skate'] },
      { emoji: '🏋️', keywords: ['gym', 'workout', 'fitness'] },
      { emoji: '🤼', keywords: ['wrestlers'] },
      { emoji: '🤸', keywords: ['cartwheel'] },
      { emoji: '⛹️', keywords: ['basketball_player'] },
      { emoji: '🧘', keywords: ['yoga', 'meditate'] },
      { emoji: '🏄', keywords: ['surf'] },
      { emoji: '🏊', keywords: ['swimming'] },
      { emoji: '🚴', keywords: ['bicyclist'] },
      { emoji: '🏆', keywords: ['trophy', 'win', 'first'] },
      { emoji: '🥇', keywords: ['gold_medal'] },
      { emoji: '🥈', keywords: ['silver_medal'] },
      { emoji: '🥉', keywords: ['bronze_medal'] },
      { emoji: '🏅', keywords: ['medal'] },
      { emoji: '🎖️', keywords: ['military_medal'] },
      { emoji: '🎟️', keywords: ['ticket'] },
      { emoji: '🎪', keywords: ['circus'] },
      { emoji: '🎭', keywords: ['theater'] },
      { emoji: '🎨', keywords: ['art', 'paint'] },
      { emoji: '🎬', keywords: ['clapper', 'movie'] },
      { emoji: '🎤', keywords: ['microphone', 'sing'] },
      { emoji: '🎧', keywords: ['headphone', 'music'] },
      { emoji: '🎼', keywords: ['musical_score'] },
      { emoji: '🎹', keywords: ['piano', 'keyboard'] },
      { emoji: '🥁', keywords: ['drum'] },
      { emoji: '🎷', keywords: ['saxophone'] },
      { emoji: '🎺', keywords: ['trumpet'] },
      { emoji: '🎸', keywords: ['guitar'] },
      { emoji: '🎻', keywords: ['violin'] },
      { emoji: '🎲', keywords: ['dice', 'games'] },
      { emoji: '♟️', keywords: ['chess'] },
      { emoji: '🎯', keywords: ['target'] },
      { emoji: '🎳', keywords: ['bowling'] },
      { emoji: '🎮', keywords: ['gamer', 'controller'] },
      { emoji: '🎰', keywords: ['slot_machine'] },
      { emoji: '🧩', keywords: ['puzzle'] }
    ]
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💡',
    emojis: [
      { emoji: '💡', keywords: ['light_bulb', 'idea'] },
      { emoji: '🔦', keywords: ['flashlight'] },
      { emoji: '🕯️', keywords: ['candle'] },
      { emoji: '📱', keywords: ['smartphone', 'phone'] },
      { emoji: '📲', keywords: ['calling_phone'] },
      { emoji: '💻', keywords: ['laptop', 'computer', 'code'] },
      { emoji: '⌨️', keywords: ['keyboard'] },
      { emoji: '🖥️', keywords: ['desktop'] },
      { emoji: '🖨️', keywords: ['printer'] },
      { emoji: '🖱️', keywords: ['mouse'] },
      { emoji: '💾', keywords: ['floppy_disk', 'save'] },
      { emoji: '💿', keywords: ['cd'] },
      { emoji: '📷', keywords: ['camera', 'photo'] },
      { emoji: '📸', keywords: ['camera_flash'] },
      { emoji: '📹', keywords: ['video_camera'] },
      { emoji: '🎥', keywords: ['movie_camera'] },
      { emoji: '📞', keywords: ['telephone'] },
      { emoji: '📺', keywords: ['tv'] },
      { emoji: '📻', keywords: ['radio'] },
      { emoji: '⏰', keywords: ['alarm_clock'] },
      { emoji: '⏳', keywords: ['hourglass'] },
      { emoji: '💰', keywords: ['money_bag', 'cash'] },
      { emoji: '💵', keywords: ['banknote'] },
      { emoji: '💳', keywords: ['credit_card'] },
      { emoji: '💎', keywords: ['diamond', 'gem'] },
      { emoji: '⚖️', keywords: ['scales', 'justice'] },
      { emoji: '🔧', keywords: ['wrench', 'tool'] },
      { emoji: '🔨', keywords: ['hammer'] },
      { emoji: '🧱', keywords: ['brick'] },
      { emoji: '🔑', keywords: ['key'] },
      { emoji: '🔒', keywords: ['locked'] },
      { emoji: '🔓', keywords: ['unlocked'] },
      { emoji: '📦', keywords: ['package', 'box'] },
      { emoji: '✉️', keywords: ['envelope', 'mail'] },
      { emoji: '📝', keywords: ['memo', 'note'] },
      { emoji: '📄', keywords: ['file', 'doc'] },
      { emoji: '📅', keywords: ['calendar', 'date'] },
      { emoji: '📁', keywords: ['folder'] },
      { emoji: '📊', keywords: ['chart'] },
      { emoji: '📈', keywords: ['chart_up'] },
      { emoji: '📌', keywords: ['pushpin'] },
      { emoji: '📎', keywords: ['paperclip'] },
      { emoji: '✏️', keywords: ['pencil'] },
      { emoji: '📚', keywords: ['books', 'library'] },
      { emoji: '🎁', keywords: ['gift', 'present'] }
    ]
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '❤️',
    emojis: [
      { emoji: '❤️', keywords: ['red_heart', 'love'] },
      { emoji: '🩷', keywords: ['pink_heart'] },
      { emoji: '🧡', keywords: ['orange_heart'] },
      { emoji: '💛', keywords: ['yellow_heart'] },
      { emoji: '💚', keywords: ['green_heart'] },
      { emoji: '💙', keywords: ['blue_heart'] },
      { emoji: '🩵', keywords: ['light_blue_heart'] },
      { emoji: '💜', keywords: ['purple_heart'] },
      { emoji: '🤎', keywords: ['brown_heart'] },
      { emoji: '🖤', keywords: ['black_heart'] },
      { emoji: '🩶', keywords: ['grey_heart'] },
      { emoji: '🤍', keywords: ['white_heart'] },
      { emoji: '💔', keywords: ['broken_heart'] },
      { emoji: '❤️‍🔥', keywords: ['heart_fire'] },
      { emoji: '❤️‍🩹', keywords: ['mending_heart'] },
      { emoji: '❣️', keywords: ['heart_exclamation'] },
      { emoji: '💕', keywords: ['two_hearts'] },
      { emoji: '💞', keywords: ['revolving_hearts'] },
      { emoji: '💓', keywords: ['beating_heart'] },
      { emoji: '💗', keywords: ['growing_heart'] },
      { emoji: '💖', keywords: ['sparkling_heart'] },
      { emoji: '💘', keywords: ['cupid'] },
      { emoji: '💝', keywords: ['gift_heart'] },
      { emoji: '✨', keywords: ['sparkles', 'magic'] },
      { emoji: '⭐', keywords: ['star'] },
      { emoji: '🌟', keywords: ['glowing_star'] },
      { emoji: '💫', keywords: ['dizzy_star'] },
      { emoji: '🔥', keywords: ['fire', 'flame', 'lit'] },
      { emoji: '💥', keywords: ['boom'] },
      { emoji: '⚡', keywords: ['zap', 'power'] },
      { emoji: '☀️', keywords: ['sun', 'weather'] },
      { emoji: '🌙', keywords: ['moon', 'night'] },
      { emoji: '🌈', keywords: ['rainbow'] },
      { emoji: '💬', keywords: ['chat', 'speech'] },
      { emoji: '💭', keywords: ['thought'] },
      { emoji: '🔔', keywords: ['bell', 'notification'] },
      { emoji: '🔕', keywords: ['mute'] },
      { emoji: '📢', keywords: ['loudspeaker'] },
      { emoji: '📣', keywords: ['megaphone'] },
      { emoji: '⚠️', keywords: ['warning'] },
      { emoji: '🚫', keywords: ['prohibited'] },
      { emoji: '✅', keywords: ['check_mark', 'yes'] },
      { emoji: '❌', keywords: ['cross_mark', 'no'] },
      { emoji: '💯', keywords: ['100', 'perfect'] },
      { emoji: '❓', keywords: ['question'] },
      { emoji: '❗', keywords: ['exclamation'] }
    ]
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: '🏁',
    emojis: [
      { emoji: '🏁', keywords: ['chequered_flag', 'race'] },
      { emoji: '🚩', keywords: ['red_flag', 'warning'] },
      { emoji: '🎌', keywords: ['crossed_flags'] },
      { emoji: '🏴‍☠️', keywords: ['pirate_flag'] },
      { emoji: '🇰🇪', keywords: ['flag_kenya', 'kenya'] },
      { emoji: '🇺🇸', keywords: ['flag_usa', 'america'] },
      { emoji: '🇬🇧', keywords: ['flag_uk', 'britain'] },
      { emoji: '🇨🇦', keywords: ['flag_canada'] },
      { emoji: '🇳🇬', keywords: ['flag_nigeria'] },
      { emoji: '🇿🇦', keywords: ['flag_south_africa'] },
      { emoji: '🇬🇭', keywords: ['flag_ghana'] },
      { emoji: '🇹ℤ', keywords: ['flag_tanzania'] },
      { emoji: '🇺🇬', keywords: ['flag_uganda'] },
      { emoji: '🇫🇷', keywords: ['flag_france'] },
      { emoji: '🇩🇪', keywords: ['flag_germany'] },
      { emoji: '🇮🇹', keywords: ['flag_italy'] },
      { emoji: '🇪🇸', keywords: ['flag_spain'] },
      { emoji: '🇧🇷', keywords: ['flag_brazil'] },
      { emoji: '🇯🇵', keywords: ['flag_japan'] },
      { emoji: '🇰🇷', keywords: ['flag_korea'] },
      { emoji: '🇨🇳', keywords: ['flag_china'] },
      { emoji: '🇮🇳', keywords: ['flag_india'] },
      { emoji: '🇦🇺', keywords: ['flag_australia'] }
    ]
  }
]

// Strict validator helper: Returns true ONLY if string is a valid emoji character and NOT a text word
function isValidEmojiGlyph(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  const trimmed = str.trim()
  if (!trimmed) return false
  // Reject plain English words or ASCII text strings (A-Z, a-z)
  if (/[a-zA-Z]/.test(trimmed)) return false
  return true
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose?: () => void
  isBottomSheet?: boolean
}

export default function EmojiPicker({ onSelect, onClose, isBottomSheet = false }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<string>('smileys')
  const [searchQuery, setSearchQuery] = useState('')
  const [recentEmojis, setRecentEmojis] = useState<string[]>([])
  const scrollViewRef = useRef<HTMLDivElement | null>(null)

  // Load recently used emojis from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('frequently_used_emojis') || localStorage.getItem('recent_emojis')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validRecents = parsed.filter(isValidEmojiGlyph).slice(0, 24)
          setRecentEmojis(validRecents)
        }
      }
    } catch (e) { }
  }, [])

  const handleEmojiClick = (emoji: string) => {
    if (!isValidEmojiGlyph(emoji)) return

    setRecentEmojis(prev => {
      const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 24)
      try {
        localStorage.setItem('frequently_used_emojis', JSON.stringify(updated))
        localStorage.setItem('recent_emojis', JSON.stringify(updated))
      } catch (e) { }
      return updated
    })

    onSelect(emoji)
  }

  // Filter emojis by search query across all categories (with strict glyph validation)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const results: string[] = []
    const seen = new Set<string>()

    EMOJI_CATEGORIES.forEach(cat => {
      cat.emojis.forEach(item => {
        if (isValidEmojiGlyph(item.emoji) && !seen.has(item.emoji)) {
          const matchesKeyword = item.keywords.some(k => k.includes(q))
          if (matchesKeyword || item.emoji.includes(q)) {
            seen.add(item.emoji)
            results.push(item.emoji)
          }
        }
      })
    })

    return results
  }, [searchQuery])

  const scrollToCategory = (catId: string) => {
    setActiveTab(catId)
    const el = document.getElementById(`cat-sec-${catId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  return (
    <div className={`emoji-picker-container ${isBottomSheet ? 'bottom-sheet' : 'popover'}`}>
      {/* 1. TOP ROW: Category Icon Tabs Row with Active Underline Indicator */}
      <div className="emoji-picker-tabs-row">
        {recentEmojis.length > 0 && (
          <button
            type="button"
            className={`emoji-tab-item ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => scrollToCategory('recent')}
            title="Recent"
          >
            <span className="emoji-tab-icon">🕒</span>
          </button>
        )}
        {EMOJI_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`emoji-tab-item ${activeTab === cat.id ? 'active' : ''}`}
            onClick={() => scrollToCategory(cat.id)}
            title={cat.name}
          >
            <span className="emoji-tab-icon">{cat.icon}</span>
          </button>
        ))}
      </div>

      {/* 2. SECOND ROW: Search Input directly below Category Tabs */}
      <div className="emoji-picker-search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="emoji-search-input"
          placeholder="Search emoji"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery ? (
          <button className="search-clear-btn" onClick={() => setSearchQuery('')} type="button">
            ✕
          </button>
        ) : (
          onClose && (
            <button type="button" className="picker-close-btn" onClick={onClose} title="Close emoji picker">
              ✕
            </button>
          )
        )}
      </div>

      {/* 3. MAIN BODY: Scrollable Emoji Viewport */}
      <div className="emoji-picker-body" ref={scrollViewRef}>
        {searchQuery ? (
          searchResults.length > 0 ? (
            <div className="emoji-section">
              <div className="emoji-section-header">Search Results ({searchResults.length})</div>
              <div className="emoji-grid-dense">
                {searchResults.map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="emoji-btn"
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="emoji-empty-search">
              <span>🔍</span>
              <p>No matching emojis found</p>
            </div>
          )
        ) : (
          <>
            {/* Frequently Used Section */}
            {recentEmojis.length > 0 && (
              <div className="emoji-section" id="cat-sec-recent">
                <div className="emoji-section-header">Recent</div>
                <div className="emoji-grid-dense">
                  {recentEmojis.filter(isValidEmojiGlyph).map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="emoji-btn"
                      onClick={() => handleEmojiClick(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Sections */}
            {EMOJI_CATEGORIES.map(cat => (
              <div key={cat.id} className="emoji-section" id={`cat-sec-${cat.id}`}>
                <div className="emoji-section-header">{cat.name}</div>
                <div className="emoji-grid-dense">
                  {cat.emojis
                    .filter(item => isValidEmojiGlyph(item.emoji))
                    .map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="emoji-btn"
                        onClick={() => handleEmojiClick(item.emoji)}
                      >
                        {item.emoji}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
