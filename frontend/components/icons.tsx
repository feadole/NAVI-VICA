/* NAVI-VICA icon set — the mockup's stroke icons, drawn with react-native-svg.
   All 24×24, stroke 2, round caps, no fill: pass `color` and `size`. */
import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

export type IconProps = { size?: number; color?: string; strokeWidth?: number };

function wrap(children: (p: Required<IconProps>) => React.ReactNode) {
  return function Icon({ size = 24, color = "#3B2A20", strokeWidth = 2 }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children({ size, color, strokeWidth })}
      </Svg>
    );
  };
}

export const MicIcon = wrap(() => (<>
  <Rect x={9} y={2} width={6} height={12} rx={3} />
  <Path d="M5 10a7 7 0 0 0 14 0" />
  <Path d="M12 17v4M8 21h8" />
</>));

export const EyeIcon = wrap(() => (<>
  <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
  <Circle cx={12} cy={12} r={3} />
</>));

export const CompassIcon = wrap(() => (<>
  <Circle cx={12} cy={12} r={10} />
  <Path d="M16 8l-2.5 5.5L8 16l2.5-5.5z" />
</>));

export const AlarmIcon = wrap(() => (<>
  <Circle cx={12} cy={13} r={8} />
  <Path d="M12 9v4l2.5 2M5 3L2 6M19 3l3 3" />
</>));

export const HeartPulseIcon = wrap(() => (<>
  <Path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12C19 16.6 12 21 12 21z" />
  <Path d="M3 12h4l2-3 3 6 2-3h7" />
</>));

export const PhoneIcon = wrap(() => (
  <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
));

export const ChatIcon = wrap(() => (
  <Path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" />
));

export const GlobeIcon = wrap(() => (<>
  <Circle cx={12} cy={12} r={10} />
  <Path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
</>));

export const UserIcon = wrap(() => (<>
  <Circle cx={12} cy={8} r={4} />
  <Path d="M4 21a8 8 0 0 1 16 0" />
</>));

export const CameraIcon = wrap(() => (<>
  <Path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  <Circle cx={12} cy={13} r={3.5} />
</>));

export const PinIcon = wrap(() => (<>
  <Path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
  <Circle cx={12} cy={10} r={2.5} />
</>));

export const BraceletIcon = wrap(() => (<>
  <Rect x={7} y={6} width={10} height={12} rx={3} />
  <Path d="M9 6V3h6v3M9 18v3h6v-3" />
</>));

export const GaugeIcon = wrap(() => (<>
  <Path d="M4 14a8 8 0 0 1 16 0" />
  <Path d="M12 14l3.5-4" />
  <Path d="M4 18h16" />
</>));

export const BellIcon = wrap(() => (<>
  <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
  <Path d="M10 21a2 2 0 0 0 4 0" />
</>));

export const CheckIcon = wrap(() => (
  <Path d="M5 12.5l4.5 4.5L19 7.5" />
));

export const BackIcon = wrap(() => (
  <Path d="M15 18l-6-6 6-6" />
));

export const ChevronRightIcon = wrap(() => (
  <Path d="M9 6l6 6-6 6" />
));

export const GearIcon = wrap(() => (<>
  <Circle cx={12} cy={12} r={3} />
  <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
</>));

export const PlusIcon = wrap(() => (
  <Path d="M12 5v14M5 12h14" />
));

export const MinusIcon = wrap(() => (
  <Path d="M5 12h14" />
));

export const SpeakerIcon = wrap(() => (<>
  <Path d="M11 5L6 9H2v6h4l5 4z" />
  <Path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13" />
</>));

export const SendIcon = wrap(() => (<>
  <Path d="M22 2L11 13" />
  <Path d="M22 2l-7 20-4-9-9-4z" />
</>));

export const MapIcon = wrap(() => (<>
  <Path d="M1 6v16l7-3 8 3 7-3V3l-7 3-8-3z" />
  <Path d="M8 3v16M16 6v16" />
</>));

export const ShareIcon = wrap(() => (<>
  <Circle cx={18} cy={5} r={3} />
  <Circle cx={6} cy={12} r={3} />
  <Circle cx={18} cy={19} r={3} />
  <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
</>));

export const BookIcon = wrap(() => (<>
  <Path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
  <Path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
</>));

export const PillIcon = wrap(() => (<>
  <Rect x={3} y={9} width={18} height={6} rx={3} transform="rotate(-45 12 12)" />
  <Path d="M8.5 15.5l7-7" />
</>));

export const SunIcon = wrap(() => (<>
  <Circle cx={12} cy={12} r={4} />
  <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
</>));

export const MoonIcon = wrap(() => (
  <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
));

export const TextSizeIcon = wrap(() => (<>
  <Path d="M4 7V5h12v2M10 5v14M7 19h6" />
  <Path d="M16 12h5M18.5 12v7" />
</>));

export const WalkIcon = wrap(() => (<>
  <Circle cx={13} cy={4} r={2} />
  <Path d="M13 7l-2 5 3 3v6M11 12l-3 2-2 5M14 10l3 2 3-1" />
</>));

export const HomeIcon = wrap(() => (<>
  <Path d="M3 11l9-8 9 8" />
  <Path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
</>));

export const PauseIcon = wrap(() => (
  <Path d="M9 5v14M15 5v14" />
));

export const XIcon = wrap(() => (
  <Path d="M6 6l12 12M18 6L6 18" />
));
