import { type FC, type PropsWithChildren, type ReactNode, type RefAttributes, createContext, isValidElement, useContext } from "react";
import {
    ToggleButton as AriaToggleButton,
    ToggleButtonGroup as AriaToggleButtonGroup,
    type ToggleButtonGroupProps,
    type ToggleButtonProps,
} from "react-aria-components";
import { cx, sortCx } from "../utils/cx";
import { isReactComponent } from "../utils/is-react-component";

export const styles = sortCx({
    common: {
        root: [
            "group/button-group inline-flex h-max cursor-pointer items-center bg-primary font-semibold whitespace-nowrap text-secondary shadow-skeumorphic ring-1 ring-primary outline-brand transition duration-100 ease-linear ring-inset",
            // Hover and focus styles
            "hover:bg-primary_hover hover:text-secondary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2",
            // Disabled styles
            "disabled:cursor-not-allowed disabled:bg-primary disabled:text-disabled",
            // Selected styles
            "selected:bg-active selected:text-secondary_hover selected:disabled:bg-disabled_subtle",
        ].join(" "),
        icon: "pointer-events-none text-fg-quaternary transition-[inherit] group-hover/button-group:text-fg-quaternary_hover group-disabled/button-group:text-fg-disabled_subtle",
    },

    sizes: {
        sm: {
            root: "gap-1.5 px-3.5 py-2 text-sm not-last:pr-[calc(calc(var(--spacing)*3.5)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3 data-icon-only:p-2",
            icon: "size-5",
        },
        md: {
            root: "gap-1.5 px-4 py-2.5 text-sm not-last:pr-[calc(calc(var(--spacing)*4)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3.5 data-icon-only:px-3",
            icon: "size-5",
        },
        lg: {
            root: "gap-2 px-4.5 py-2.5 text-md not-last:pr-[calc(calc(var(--spacing)*4.5)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-4 data-icon-only:p-3",
            icon: "size-5",
        },
    },
});

export type ButtonSize = keyof typeof styles.sizes;

const ButtonGroupContext = createContext<{ size: ButtonSize; orientation?: "horizontal" | "vertical"; }>({ size: "md" });

export interface ButtonGroupItemProps extends ToggleButtonProps, RefAttributes<HTMLButtonElement> {
    iconLeading?: FC<{ className?: string; }> | ReactNode;
    iconTrailing?: FC<{ className?: string; }> | ReactNode;
    onClick?: () => void;
    className?: string;
}

export const ButtonGroupItem = (props: PropsWithChildren<ButtonGroupItemProps>) => {
    const {
        iconLeading: IconLeading,
        iconTrailing: IconTrailing,
        children,
        className,
        ...otherProps
    } = props;
    const context = useContext(ButtonGroupContext);

    if (!context) {
        throw new Error("ButtonGroupItem must be used within a ButtonGroup component");
    }

    const { size, orientation = "horizontal" } = context;

    const isIcon = (IconLeading || IconTrailing) && !children;

    // Adjust border radius for vertical/horizontal orientation
    let radiusClass = "";
    if (orientation === "vertical") {
        radiusClass = "first:rounded-t-lg last:rounded-b-lg first:rounded-bl-none last:rounded-tr-none";
    } else {
        radiusClass = "first:rounded-l-lg last:rounded-r-lg first:rounded-tr-none last:rounded-bl-none";
    }

    return (
        <AriaToggleButton
            {...otherProps}
            data-icon-only={isIcon ? true : undefined}
            data-icon-leading={IconLeading ? true : undefined}
            className={cx(styles.common.root, styles.sizes[size].root, radiusClass, className)}
        >
            {isReactComponent(IconLeading) && <IconLeading className={cx(styles.common.icon, styles.sizes[size].icon)} />}
            {isValidElement(IconLeading) && IconLeading}

            {children}

            {isReactComponent(IconTrailing) && <IconTrailing className={cx(styles.common.icon, styles.sizes[size].icon)} />}
            {isValidElement(IconTrailing) && IconTrailing}
        </AriaToggleButton>
    );
};

export interface ButtonGroupProps extends ToggleButtonGroupProps, RefAttributes<HTMLDivElement> {
    size?: ButtonSize;
    className?: string;
}

export const ButtonGroup: FC<PropsWithChildren<ButtonGroupProps>> = (props) => {
    const {
        children,
        size = "md",
        className,
        orientation = "horizontal",
        ...otherProps
    } = props;
    // Determine flex direction and spacing based on orientation
    const orientationClasses =
        orientation === "vertical"
            ? "flex-col -space-y-px"
            : "flex-row -space-x-px";

    // For vertical, remove inline-flex and use flex-col, for horizontal keep inline-flex
    const baseFlex = orientation === "vertical" ? "flex" : "inline-flex";

    return (
        <ButtonGroupContext.Provider value={{ size, orientation }}>
            <AriaToggleButtonGroup
                selectionMode="single"
                orientation={orientation}
                className={cx(
                    `relative z-0 w-max ${baseFlex} ${orientationClasses} rounded-lg shadow-xs`,
                    className
                )}
                {...otherProps}
            >
                {children}
            </AriaToggleButtonGroup>
        </ButtonGroupContext.Provider>
    );
};
