import { Outlet } from "react-router";
import { NavBar } from "../components/navBar";
import { useGlobalContext } from "../utils/context";
import { GlobalLoadingIcon } from "../components/GlobalLoadingIcon";
import { ChangePasswordModal } from "../components/modals/changePasswordModal";

export const SharedLayout = () => {
  const { globalLoading, changePasswordModal } = useGlobalContext();

  return (
    <div>
      {globalLoading && <GlobalLoadingIcon />}
      {changePasswordModal && <ChangePasswordModal />}
      <div className="lg:w-[calc(100vw-238px)] lg:ml-auto ">
        <NavBar />
        <div className=" pt-20 md:pt-24  pb-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
