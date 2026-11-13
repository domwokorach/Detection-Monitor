import { type ComponentProps, useEffect, useRef } from "react";

import { type AnimationPlaybackControls, animate, stagger } from "motion/react";
import SplitType, { type SplitTypeOptions } from "split-type";

type SplitTypeKey = "chars" | "words" | "lines";

type RevealTextProps = {
    type?: SplitTypeKey;
    motionOptions?: Parameters<typeof animate>[2];
    motionKeyframes?: Parameters<typeof animate>[1];
    onSetup?: (elements: HTMLElement[]) => void;
    splitOptions?: Partial<SplitTypeOptions>;
} & ComponentProps<"div">;

export const RevealText = ({
    type = "chars",
    motionOptions = {},
    motionKeyframes,
    onSetup,
    splitOptions = {},
    children,
    ...props
}: RevealTextProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = wrapperRef.current;
        if (!element) return;

        const splitText = new SplitType(element, { types: type, ...splitOptions });
        const targets = splitText[type];

        if (!targets || targets.length === 0) return;

        if (onSetup) {
            onSetup(targets);
        }

        let animation: AnimationPlaybackControls | undefined;

        if (motionKeyframes) {
            animation = animate(targets, motionKeyframes, motionOptions);
        } else if (type === "chars") {
            animation = animate(
                targets,
                { x: [150, 0], opacity: [0, 1] },
                { duration: 0.7, ease: "easeOut", delay: stagger(0.05), ...motionOptions },
            );
        } else if (type === "words") {
            targets.forEach((el, i) => {
                const randomRot = Math.sin(i * 4567) * 80;
                el.style.transform = `translate(150px, -100px) rotate(${randomRot}deg)`;
                el.style.opacity = "0";
            });

            animation = animate(
                targets,
                { x: 0, y: 0, opacity: 1, rotate: 0 },
                { duration: 1, ease: "easeOut", delay: stagger(0.2), ...motionOptions },
            );
        } else if (type === "lines") {
            animation = animate(
                targets,
                { y: ["100%", "0%"], opacity: [0, 1] },
                { duration: 1, ease: "circOut", delay: stagger(0.4), ...motionOptions },
            );
        }

        return () => {
            if (animation) animation.stop();
            splitText.revert();
        };
    }, [type, motionOptions, motionKeyframes, onSetup, splitOptions, children]);

    return (
        <div {...props} ref={wrapperRef}>
            {children}
        </div>
    );
};
