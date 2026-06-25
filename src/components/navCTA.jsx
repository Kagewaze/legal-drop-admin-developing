import { useGlobalContext } from "../utils/context";

export const NavCTA = () => {
  const { setChangePasswordModal } = useGlobalContext();

  function handleLogout() {
    window.location.href = "/login";
    localStorage.removeItem("CRMuser");
    localStorage.removeItem("CRMACCESSTOKEN");
  }

  return (
    <div className="flex items-center  gap-x-4 justify-end ">
      {/* logout */}
      {
        <div className=" flex items-center gap-4 text-xs font-semibold ">
          <button
            onClick={() => setChangePasswordModal(true)}
            className="  p-2 rounded-md border shadow-md border-primaryGreen hover:text-primary600 globalTransition "
          >
            {" "}
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="    p-2 rounded-md  border shadow-md border-primaryGreen hover:text-primary600 globalTransition  "
          >
            {" "}
            Logout
          </button>
        </div>
      }
    </div>
  );
};
