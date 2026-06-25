import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import customFetch from "../../utils/customFetch";
import { useGlobalContext } from "../../utils/context";
import { getFormattedDateTime } from "../../utils/dateTime";
import { UpdateStatus } from "../updateStatus";
import { EditModal } from "../editFormModal";
import { Orders } from "../../pages/orders";

export const SingleUser = () => {
  const { singleUserId } = useParams();
  const [user, setUser] = useState({
    address: "",
    createdAt: "",
    deletedAt: "",
    dob: "",
    email: "",
    emailVerified: "",
    firstName: "",
    id: "",
    lastName: "",
    location: "",
    phoneNumber: "",
    photoUrl: "",
    referralCode: "",
    role: "",
    status: "",
    updatedAt: "",
  });
  const { setGlobalLoading } = useGlobalContext();

  const [showUserUpdate, setShowUserUpdate] = useState(false);
  const [showUserEditModal, setUserEditModal] = useState(false);

  async function fetchSingleUser() {
    setGlobalLoading(true);
    const url = `admin/users?id=${singleUserId}`;
    try {
      const {
        data: { data },
        status,
      } = await customFetch(url);

      if (status === 200) {
        setGlobalLoading(false);
        setUser(data[0]);
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  const {
    address,
    createdAt,
    deletedAt,
    dob,
    email,
    emailVerified,
    firstName,
    id,
    lastName,
    location,
    phoneNumber,
    photoUrl,
    referralCode,
    role,
    status,
  } = user;

  useEffect(() => {
    fetchSingleUser();
  }, []);

  return (
    <section className=" px-4">
      {/* update */}
      {showUserUpdate && (
        <UpdateStatus
          routeTitle={"user"}
          id={id}
          closeUpdateModal={setShowUserUpdate}
          seeChangesFunction={fetchSingleUser}
        />
      )}
      {/* edit */}
      {showUserEditModal && (
        <EditModal
          closeEditModal={setUserEditModal}
          userData={user}
          routeTitle={"user"}
          id={id}
          seeChangesFunction={fetchSingleUser}
        />
      )}
      {/* CTA Buttons */}
      <div className=" flex justify-between items-center">
        <h1 className=" font-semibold text-lg mb-4">User Details</h1>
        <div className=" flex flex-col md:flex-row gap-3 mb-4">
          <button
            onClick={() => setShowUserUpdate(true)}
            className="border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
          >
            Update Status
          </button>
          <button
            onClick={() => setUserEditModal(true)}
            className="border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
          >
            Edit
          </button>
        </div>
      </div>
      {/* user details */}
      <div className=" bg-gray50 p-4 rounded-md shadow-md border flex flex-col gap-y-4 text-sm md:text-base">
        {
          <p className=" h-[100px] w-[100px] border rounded-full border-primaryGreen">
            <img
              src={photoUrl}
              alt="user image"
              className=" w-full h-full object-cover rounded-full"
            />
          </p>
        }

        <p>
          <strong>First Name:</strong> {firstName ? firstName : "-"}
        </p>
        <p>
          <strong>Last Name:</strong> {lastName ? lastName : "-"}
        </p>
        <p>
          <strong>Role:</strong> {role ? role : "-"}
        </p>
        <p>
          <strong>Email:</strong> {email ? email : "-"}
        </p>
        <p>
          <strong>Email Verified:</strong> {emailVerified ? "True" : "False"}
        </p>

        <p>
          <strong>Location:</strong> {location ? location : "-"}
        </p>
        <p>
          <strong>Phone Number:</strong> {phoneNumber ? phoneNumber : "-"}
        </p>
        <p>
          <strong>Status:</strong> {status ? status : "-"}
        </p>
        <p>
          <strong>Address:</strong> {address ? address : "-"}
        </p>
        <p>
          <strong>DOB:</strong> {dob ? dob : "-"}
        </p>
        <p>
          <strong>Referral Code:</strong> {referralCode ? referralCode : "-"}
        </p>
        <p>
          <strong>Created At:</strong>{" "}
          {createdAt ? getFormattedDateTime(createdAt) : "-"}
        </p>
        <p>
          <strong>Deleted At:</strong>{" "}
          {deletedAt ? getFormattedDateTime(deletedAt) : "-"}
        </p>
        <p>
          <strong>Updated At:</strong>{" "}
          {deletedAt ? getFormattedDateTime(updatedAt) : "-"}
        </p>
      </div>
      {/* orders */}
      <Orders fetchId={singleUserId} />
    </section>
  );
};
