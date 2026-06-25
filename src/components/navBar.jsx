import { IoMdMenu } from "react-icons/io";
import { NavLinks } from "./navLinks";
import { useEffect, useState } from "react";
import { useGlobalContext } from "../utils/context";
import { NavCTA } from "./navCTA";
import { useLocation } from "react-router-dom";
import { LuHome } from "react-icons/lu";
import { TbUsers } from "react-icons/tb";
import { IoCartOutline } from "react-icons/io5";
import { PiMotorcycle } from "react-icons/pi";
import { IoMdCreate } from "react-icons/io";
import { MdOutlinePayment } from "react-icons/md";

export const NavBar = () => {
  const [showSideBar, setSideBar] = useState(false);
  const { activePageId, dispatch } = useGlobalContext();
  const location = useLocation();

  const linksData = [
    {
      id: 0,
      linkName: "Dashboard",
      linkUrl: "/",
      icon: <LuHome size={16} />,
    },
    {
      id: 1,
      linkName: "Users",
      linkUrl: "/users",
      icon: <TbUsers size={16} />,
    },
    {
      id: 2,
      linkName: "Orders",
      linkUrl: "/orders",
      icon: <IoCartOutline size={16} />,
    },
    {
      id: 3,
      linkName: "Create Order",
      linkUrl: "/create-order",
      icon: <IoMdCreate size={16} />,
    },
    {
      id: 4,
      linkName: "Riders",
      linkUrl: "/riders",
      icon: <PiMotorcycle size={16} />,
    },
    {
      id: 5,
      linkName: "Contacts",
      linkUrl: "/contacts",
      icon: <TbUsers size={16} />,
    },
    {
      id: 6,
      linkName: "Payouts",
      linkUrl: "/payouts",
      icon: <MdOutlinePayment size={16} />,
    },
  ];

  useEffect(() => {
    const currentPath = location.pathname;

    // If the current path is exactly "/", match Dashboard
    if (currentPath === "/") {
      dispatch({
        type: "CLICK_NAV_LINK",
        payload: 0,
      });
    } else {
      // Remove the leading '/' from the path to match linkUrl
      const trimmedPath = currentPath.slice(1).toLowerCase();

      const matchedLink = linksData.find(
        (link) =>
          link.linkUrl !== "/" &&
          trimmedPath.startsWith(link.linkUrl.slice(1).toLowerCase())
      );

      if (matchedLink) {
        dispatch({
          type: "CLICK_NAV_LINK",
          payload: matchedLink.id,
        });
      }
    }
  }, [location.pathname]);

  // DONT DELETE
  const showSidebarClassName = "sidebarBTN";

  return (
    <nav className="  p-4  border-b  border-b-primary600 w-full mb-4 fixed lg:w-[calc(100vw-238px)] top-0 z-20 bodyWhite ">
      <div className=" flex items-center justify-between">
        {/* active page */}
        <p className=" flex items-center gap-x-2 text-primary900">
          <span>{linksData[activePageId].icon}</span>
          {linksData[activePageId].linkName}
        </p>

        {/* menu button */}
        <button
          onClick={() => setSideBar(!showSideBar)}
          className={`${showSidebarClassName}  lg:hidden`}
        >
          <IoMdMenu size={24} className=" text-primaryGreen" />
        </button>
        {/* nav cta */}
        <div className=" w-fit hidden lg:block">
          <NavCTA />
        </div>
      </div>
      <NavLinks
        {...{ showSideBar, setSideBar, showSidebarClassName, linksData }}
      />
    </nav>
  );
};
