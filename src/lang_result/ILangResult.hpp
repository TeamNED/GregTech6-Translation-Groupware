#ifndef ILANGRESULT_H
#define ILANGRESULT_H
#pragma once

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "../meta/IGeneratorMeta.hpp"

using std::shared_ptr;
using std::string;
using kvlist = std::unordered_map<string, string>;
using pkvlist = shared_ptr<kvlist>;

class ILangResult {
private:
public:
  virtual shared_ptr<IGeneratorMeta> meta() = 0;
  virtual pkvlist result() = 0;
};
#endif