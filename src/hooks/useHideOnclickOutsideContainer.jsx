import { useEffect } from "react";

export function useHideOnclickOutsideContainer(
  containerRef,
  showContainerBtnClassname,
  hideContainerFunction,
  condition = true // Default to true if condition is not provided
) {
  useEffect(() => {
    function hideOnclickOutsideContainer(e) {
      const clickedElement = e.target;

      // Check if the clicked element or its parent has the button class
      const isButtonClick =
        clickedElement.classList.contains(showContainerBtnClassname) ||
        clickedElement.closest(`.${showContainerBtnClassname}`);

      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !isButtonClick
      ) {
        if (condition) {
          hideContainerFunction(false);
        }
      }
    }

    document.addEventListener("click", hideOnclickOutsideContainer);

    return () => {
      document.removeEventListener("click", hideOnclickOutsideContainer);
    };
  }, [
    containerRef,
    showContainerBtnClassname,
    hideContainerFunction,
    condition,
  ]);
}
