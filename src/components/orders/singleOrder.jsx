import { useParams } from "react-router-dom";
import { useOrdersContext } from "../../utils/ordersContext";
import { AssignOrder } from "./assignOrder";
import { useEffect, useState } from "react";
import customFetch from "../../utils/customFetch";
import { useGlobalContext } from "../../utils/context";
import { getFormattedDateTime } from "../../utils/dateTime";
import { ImageModal } from "../imageModal";

export const SingleOrder = () => {
  const { showAssignOrder, setShowAssignOrder, showImage, setShowImage } =
    useOrdersContext();
  const { setGlobalLoading } = useGlobalContext();
  const { singleOrderId } = useParams();

  const [imageData, setShowImageData] = useState("");

  const [order, setOrder] = useState({
    id: "",
    trackingCode: "",
    createdAt: "",
    status: "",
    paid: "",
    fee: "",
    paymentMethod: "",
    type: "",
    vehicle: "",
    senderName: "",
    senderPhone: "",
    senderAddress: "",
    senderEmail: "",
    pickupOtp: "",
    senderNote: "",
    deliveryPoint: [
      {
        receiverName: "",
        receiverPhone: "",
        receiverAddress: "",
        receiverNote: "",
        deliveryOtp: "",
        weight: "",
        quantity: "",
        status: "",
        distance: "",
        deliveryConfirmationImage: "",
        itemImages: [],
        categories: [],
      },
    ],
    distance: "",
    onRouteToDelivery: "",
    packageDelivered: "",
    deliveryConfirmationImage: "",
    fragility: "",
    topPriority: "",
    driver: {
      address: "",
      email: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
    },
  });

  const {
    id,
    trackingCode,
    createdAt,
    status,
    paid,
    fee,
    paymentMethod,
    type,
    vehicle,
    senderName,
    senderPhone,
    senderAddress,
    senderEmail,
    pickupOtp,
    senderNote,
    pickUpTime,
    isAccepted,
    driverUserId,
    onRouteToPickup,
    packagePickedUp,
    section,
    deliveryPoint,
    driver,
  } = order;

  const { firstName, lastName, email, phoneNumber } = order.driver ?? {};

  async function fetchSingleOrder() {
    setGlobalLoading(true);
    const url = `admin/orders?orderId=${singleOrderId}`;

    try {
      const {
        data: { data },
        status,
      } = await customFetch(url);

      if (status === 200) {
        setGlobalLoading(false);
        setOrder(data[0]);
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  useEffect(() => {
    fetchSingleOrder();
  }, []);

  function handleClickImage(imgData) {
    setShowImage(true);
    setShowImageData(imgData);
  }

  return (
    <>
      {showAssignOrder && <AssignOrder orderId={id} />}
      {showImage && (
        <ImageModal data={imageData} closeImgModal={setShowImage} />
      )}
      <div className="p-2 md:p-4  text-gray700">
        {order ? (
          <>
            <h1 className=" font-bold text-gray900 mb-4 flex justify-between">
              <span className=" text-lg md:text-2xl">Order Details</span>
              <button
                onClick={() => setShowAssignOrder(true)}
                className=" border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs md:text-sm"
              >
                Assign Order
              </button>
            </h1>

            {/* General Information */}
            <div className="mb-10  shadow-md p-2 py-4 rounded-md border bg-gray50">
              <h2 className="text-lg font-semibold text-black mb-4">
                General Information
              </h2>
              <div className=" pl-4 grid md:grid-cols-2 gap-6 place-content-between text-sm md:text-base">
                <p>
                  <strong>Order ID:</strong> {id}
                </p>
                <p>
                  <strong>Tracking Code:</strong> {trackingCode}
                </p>
                <p>
                  <strong>Created At:</strong>{" "}
                  {createdAt ? getFormattedDateTime(createdAt) : "-"}
                </p>
                <p>
                  <strong>Status:</strong>
                  <span
                    className={`ml-2 px-2 py-1 rounded ${
                      status === "pending"
                        ? "bg-yellow-200 text-yellow-700"
                        : "bg-green-200 text-green-700"
                    }`}
                  >
                    {status}
                  </span>
                </p>
                <p>
                  <strong>Paid:</strong> {paid ? "Yes" : "No"}
                </p>
                <p>
                  <strong>Pickup Time:</strong>{" "}
                  {pickUpTime ? getFormattedDateTime(pickUpTime) : "-"}
                </p>
                <p>
                  <strong>Is Accepted:</strong> {isAccepted ? "True" : "False"}
                </p>
                <p>
                  <strong>Fee:</strong> ${fee}
                </p>
                <p>
                  <strong>Payment Method:</strong> {paymentMethod}
                </p>
                <p>
                  <strong>Type:</strong> {type}
                </p>
                <p>
                  <strong>Vehicle:</strong> {vehicle}
                </p>
                <p>
                  <strong>DriverUserId:</strong>{" "}
                  {driverUserId ? driverUserId : "-"}
                </p>
                <p>
                  <strong>On Route To Pickup:</strong>{" "}
                  {onRouteToPickup
                    ? getFormattedDateTime(onRouteToPickup)
                    : "-"}
                </p>
                <p>
                  <strong>Package Picked Up:</strong>{" "}
                  {packagePickedUp
                    ? getFormattedDateTime(packagePickedUp)
                    : "-"}
                </p>
                <p>
                  <strong>Section:</strong> {section ? section : "-"}
                </p>
              </div>
            </div>

            {/* Driver Information */}
            <div className="mb-10 shadow-md p-2 py-4 rounded-md border bg-gray50">
              <h2 className="text-lg font-semibold text-black mb-4">
                Driver Information
              </h2>
              {!driver ? (
                <p className=" font-semibold text-sm md:text-base">
                  {" "}
                  A Driver has not been assigned to this order yet
                </p>
              ) : (
                <div className=" pl-4 grid md:grid-cols-2 gap-6 place-content-between text-sm md:text-base">
                  <p>
                    <strong>First Name:</strong> {firstName ? firstName : "-"}
                  </p>
                  <p>
                    <strong>Last Name:</strong> {lastName ? lastName : "-"}
                  </p>
                  <p>
                    <strong>Email:</strong> {email ? email : "-"}
                  </p>
                  <p>
                    <strong>Phone Number:</strong>{" "}
                    {phoneNumber ? phoneNumber : "-"}
                  </p>
                </div>
              )}
            </div>

            {/* Sender Information */}
            <div className="mb-10 shadow-md p-2 py-4 rounded-md border bg-gray50">
              <h2 className="text-lg font-semibold text-black mb-4">
                Sender Information
              </h2>
              <div className=" pl-4 grid md:grid-cols-2 gap-6 place-content-between text-sm md:text-base">
                <p>
                  <strong>Sender Name:</strong> {senderName}
                </p>
                <p>
                  <strong>Sender Phone:</strong> {senderPhone}
                </p>
                <p>
                  <strong>Sender Address:</strong> {senderAddress}
                </p>
                <p>
                  <strong>Sender Email:</strong> {senderEmail}
                </p>
                <p>
                  <strong>Pickup OTP:</strong> {pickupOtp}
                </p>
                <p>
                  <strong>Sender Note:</strong>{" "}
                  {senderNote || "No note provided"}
                </p>
              </div>
            </div>

            {/* Receiver Information */}
            <div className="mb-10 shadow-md p-2 py-4 rounded-md border bg-gray50">
              <h2 className="text-lg mb-4 font-semibold text-gray800">
                Receiver Information
              </h2>
              {deliveryPoint.length < 1 ? (
                <p className=" font-semibold text-sm md:text-base pl-4">
                  {" "}
                  No reciever added yet
                </p>
              ) : (
                <div>
                  {deliveryPoint.map(
                    (
                      {
                        receiverName,
                        receiverPhone,
                        receiverAddress,
                        receiverNote,
                        deliveryOtp,
                        weight,
                        quantity,
                        status,
                        distance,
                        onRouteToDelivery,
                        packageDelivered,
                        deliveryConfirmationImage,
                        fragility,
                        topPriority,
                        categories,
                        itemImages,
                      },
                      index
                    ) => (
                      <div
                        key={index}
                        className="  grid md:grid-cols-2 gap-6 place-content-between border-b mb-6 p-4 relative pt-8 text-sm md:text-base"
                      >
                        <p className=" absolute font-bold text-primaryGreen left-2">
                          Receiver {index + 1}
                        </p>
                        <p>
                          <strong>Receiver Name:</strong> {receiverName}
                        </p>
                        <p>
                          <strong>Receiver Phone:</strong> {receiverPhone}
                        </p>
                        <p>
                          <strong>Receiver Address:</strong> {receiverAddress}
                        </p>
                        <p>
                          <strong>Receiver Note:</strong>{" "}
                          {receiverNote || "No note provided"}
                        </p>
                        <p>
                          <strong>Delivery OTP:</strong> {deliveryOtp}
                        </p>
                        <p>
                          <strong>Weight:</strong> {weight} kg
                        </p>
                        <p>
                          <strong>Quantity:</strong> {quantity}
                        </p>
                        <p>
                          <strong>Distance:</strong> {distance}
                        </p>
                        <p>
                          <strong>On Route To Delivery:</strong>{" "}
                          {onRouteToDelivery
                            ? getFormattedDateTime(onRouteToDelivery)
                            : "-"}
                        </p>
                        <p>
                          <strong>Package Delivered:</strong>{" "}
                          {packageDelivered
                            ? getFormattedDateTime(packageDelivered)
                            : "-"}
                        </p>
                        <p>
                          <strong>Delivery Confirmation Image:</strong>{" "}
                          {deliveryConfirmationImage ? (
                            <button
                              onClick={() =>
                                handleClickImage(deliveryConfirmationImage)
                              }
                              className="text-primaryGreen font-semibold"
                            >
                              click to view
                            </button>
                          ) : (
                            "-"
                          )}
                        </p>

                        <p>
                          <strong>Fragility:</strong> {fragility}
                        </p>
                        <p>
                          <strong>Top Priority:</strong>{" "}
                          {topPriority ? "True" : "False"}
                        </p>
                        <p>
                          <strong>Categories:</strong>{" "}
                          {categories?.length > 0
                            ? categories.map((item) => item)
                            : "-"}
                        </p>
                        <p>
                          <strong>Status:</strong>
                          <span
                            className={`ml-2 px-2 py-1 rounded ${
                              status === "pending"
                                ? "bg-yellow-200 text-yellow-700"
                                : "bg-green-200 text-green-700"
                            }`}
                          >
                            {status}
                          </span>
                        </p>
                        <p>
                          <strong>Item Images:</strong>{" "}
                          {itemImages ? (
                            <button
                              onClick={() => handleClickImage(itemImages)}
                              className=" hover:text-primaryGreen"
                            >
                              click to view
                            </button>
                          ) : (
                            "-"
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <p>Loading order details...</p>
        )}
      </div>
    </>
  );
};
