import { Link } from "react-router-dom";
import { useHideOnclickOutsideContainer } from "../hooks/useHideOnclickOutsideContainer";
import { useRef } from "react";
import { useGlobalContext } from "../utils/context";
import { NavCTA } from "./navCTA";

export const NavLinks = ({
  showSideBar,
  showSidebarClassName,
  setSideBar,
  linksData,
}) => {
  const { windowWidth, activePageId, dispatch } = useGlobalContext();

  const asideRef = useRef(null);

  useHideOnclickOutsideContainer(
    asideRef,
    showSidebarClassName,
    setSideBar,
    windowWidth < 1024
  );

  function handleLink(id) {
    if (windowWidth < 1024) {
      setSideBar(false);
    }

    dispatch({
      type: "CLICK_NAV_LINK",
      payload: id,
    });
  }

  return (
    <aside
      ref={asideRef}
      className={` globalTransition border-r  border-r-primary600 fixed  w-[80%] md:w-[40%] lg:max-w-[238px] bodyWhite z-50 h-screen   text-sm  top-0 left-0 
      ${
        !showSideBar && windowWidth < 1024
          ? "-translate-x-[100%]"
          : "translate-x-0"
      } pt-6  px-4 `}
    >
      {/* logo */}
      <div className=" mb-4 font-mono text-xl">ADMIN DASHBOARD</div>

      <div className=" overflow-auto h-[95%] lg:overflow-hidden pb-8 lg:pb-0  scrollbar-hide  ">
        {/* Shadow at the bottom to show more content */}
        <div className="showMoreContentShadow"></div>

        <div className=" flex flex-col gap-y-2 ">
          {linksData.map(({ linkName, id, linkUrl, icon }) => (
            <div key={id}>
              <Link
                to={linkUrl}
                onClick={() => handleLink(id)}
                className={`globalTransition  ${
                  activePageId === id
                    ? "bg-primary800 text-green50"
                    : "bg-transparent text-gray500 hover:bg-green100 hover:text-primaryGreen"
                } flex items-center gap-x-3 rounded-md p-2 text-xs`}
              >
                <span>{icon}</span>
                <span>{linkName}</span>
              </Link>
            </div>
          ))}

          {/* nav cta only on small to medium screen */}
          <div className=" lg:hidden mt-8">
            <NavCTA />
          </div>
        </div>
      </div>
    </aside>
  );
};
