#include <iostream>
#include <string>

#include "Replacer.hpp"

using std::string;

int main(int argc, char const *argv[]) {
  Replacer config(argc, argv);
  auto result = config.generate();
  return 0;
}