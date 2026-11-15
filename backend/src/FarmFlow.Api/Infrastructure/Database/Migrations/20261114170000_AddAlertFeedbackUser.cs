using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FarmFlow.Api.Infrastructure.Database.Migrations
{
    /// <summary>Scopes alert feedback to the user who submitted it.</summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261114170000_AddAlertFeedbackUser")]
    public partial class AddAlertFeedbackUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "AlertFeedbacks",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AlertFeedbacks_UserId",
                table: "AlertFeedbacks",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_AlertFeedbacks_Users_UserId",
                table: "AlertFeedbacks",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AlertFeedbacks_Users_UserId",
                table: "AlertFeedbacks");

            migrationBuilder.DropIndex(
                name: "IX_AlertFeedbacks_UserId",
                table: "AlertFeedbacks");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "AlertFeedbacks");
        }
    }
}
